import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const { Box, Label, Button, Overlay, Revealer, Scrollable, Stack, EventBox } = Widget;
const { exec, execAsync } = Utils;
const { GLib } = imports.gi;
import Battery from 'resource:///com/github/Aylur/ags/service/battery.js';
import { MaterialIcon } from '../../.commonwidgets/materialicon.js';
import { AnimatedCircProg } from "../../.commonwidgets/cairo_circularprogress.js";
import { WWO_CODE, WEATHER_SYMBOL, NIGHT_WEATHER_SYMBOL } from '../../.commondata/weather.js';

const WEATHER_CACHE_FOLDER = `${GLib.get_user_cache_dir()}/ags/weather`;
Utils.exec(`mkdir -p ${WEATHER_CACHE_FOLDER}`);

const BarBatteryProgress = () => {
    const _updateBatteryProgress = (circprog) => { // Renamed for clarity
        circprog.css = `font-size: ${Math.abs(Battery.percent)}px;`;

        circprog.toggleClassName('bar-batt-circprog-low', Battery.percent <= userOptions.battery.low);
        circprog.toggleClassName('bar-batt-circprog-full', Battery.charged);
    }
    return AnimatedCircProg({
        className: 'bar-batt-circprog',
        vpack: 'center', hpack: 'center',
        extraSetup: (self) => self
            .hook(Battery, _updateBatteryProgress) // Updated function name
        ,
    })
}

const time = Variable('', {
    poll: [
        userOptions.time.interval,
        () => GLib.DateTime.new_now_local().format(userOptions.time.format),
    ],
});

const date = Variable('', {
    poll: [
        userOptions.time.dateInterval,
        () => GLib.DateTime.new_now_local().format(userOptions.time.dateFormatLong),
    ],
});

const BarClock = () => Widget.Box({
    vpack: 'center',
    className: 'spacing-h-4 bar-clock-box',
    children: [
        Widget.Label({
            className: 'bar-time',
            label: time.bind(),
        }),
        Widget.Label({
            className: 'txt-norm txt-onLayer1',
            label: '•',
        }),
        Widget.Label({
            className: 'txt-smallie bar-date',
            label: date.bind(),
        }),
    ],
});

const UtilButton = ({ name, icon, onClicked }) => Button({
    vpack: 'center',
    tooltipText: name,
    onClicked: onClicked,
    className: 'bar-util-btn icon-material txt-norm',
    label: `${icon}`,
});

const Utilities = () => Box({
    hpack: 'center',
    className: 'spacing-h-4',
    children: [
        UtilButton({
            name: getString('Screen snip'), icon: 'screenshot_region', onClicked: () => {
                Utils.execAsync(`${App.configDir}/scripts/grimblast.sh copy area`)
                    .catch(error => console.error("Error executing screen snip:", error)); //Improved error handling
            }
        }),
        UtilButton({
            name: getString('Color picker'), icon: 'colorize', onClicked: () => {
                Utils.execAsync(['hyprpicker', '-a']).catch(error => console.error("Error executing color picker:", error)); //Improved error handling
            }
        }),
        UtilButton({
            name: getString('Toggle on-screen keyboard'), icon: 'keyboard', onClicked: () => {
                toggleWindowOnAllMonitors('osk');
            }
        }),
    ]
});

const BarBattery = () => Box({
    className: 'spacing-h-4 bar-batt-txt',
    children: [
        Revealer({
            transitionDuration: userOptions.animations.durationSmall,
            revealChild: false,
            transition: 'slide_right',
            child: MaterialIcon('bolt', 'norm', { tooltipText: "Charging" }),
            setup: (self) => self.hook(Battery, revealer => {
                self.revealChild = Battery.charging;
            }),
        }),
        Label({
            className: 'txt-smallie',
            setup: (self) => self.hook(Battery, label => {
                label.label = `${Number.parseFloat(Battery.percent.toFixed(0))}%`;
            }),
        }),
        Overlay({
            child: Widget.Box({
                vpack: 'center',
                className: 'bar-batt',
                homogeneous: true,
                children: [
                    MaterialIcon('battery_full', 'small'),
                ],
                setup: (self) => self.hook(Battery, box => {
                    box.toggleClassName('bar-batt-low', Battery.percent <= userOptions.battery.low);
                    box.toggleClassName('bar-batt-full', Battery.charged);
                }),
            }),
            overlays: [
                BarBatteryProgress(),
            ]
        }),
    ]
});

const BarGroup = ({ child }) => Widget.Box({
    className: 'bar-group-margin bar-sides',
    children: [
        Widget.Box({
            className: 'bar-group bar-group-standalone bar-group-pad-system',
            children: [child],
        }),
    ]
});

// Helper functions for weather data handling (no changes here)
const fetchWeatherData = async (city) => {
    try {
        const response = await Utils.execAsync(`curl https://wttr.in/${city.replace(/ /g, '%20')}?format=j1`);
        return JSON.parse(response);
    } catch (error) {
        console.error("Error fetching weather data:", error);
        return null; // Return null if fetching fails
    }
};

const cacheWeatherData = (data, filePath) => {
    if (data) {
        Utils.writeFile(JSON.stringify(data), filePath).catch(error => console.error("Error caching weather data:", error));
    }
};

const updateWeatherUI = (self, weatherData) => {
    if (weatherData) {
        const weatherCode = weatherData.current_condition[0].weatherCode;
        const weatherDesc = weatherData.current_condition[0].weatherDesc[0].value;
        const temperature = weatherData.current_condition[0][`temp_${userOptions.weather.preferredUnit}`];
        const feelsLike = weatherData.current_condition[0][`FeelsLike${userOptions.weather.preferredUnit}`];
        const weatherSymbol = WEATHER_SYMBOL[WWO_CODE[weatherCode]];
        self.children[0].label = weatherSymbol;
        self.children[1].label = `${temperature}°${userOptions.weather.preferredUnit}`;
        self.tooltipText = weatherDesc;
    } else {
        // Handle the case where weatherData is null (e.g., display an error message)
        self.children[1].label = "Weather data unavailable";
    }
};

const getCityFromIP = async () => {
    try {
        const ipInfo = await Utils.execAsync('curl ipinfo.io');
        return JSON.parse(ipInfo)['city'].toLowerCase();
    } catch (error) {
        console.error("Error getting city from IP:", error);
        return null;
    }
};


const setupWeather = (self) => {
    const WEATHER_CACHE_PATH = WEATHER_CACHE_FOLDER + '/wttr.in.txt';
    self.poll(900000, async () => {
        try {
            let city = userOptions.weather.city || (await getCityFromIP());
            let weatherData = await fetchWeatherData(city);
            cacheWeatherData(weatherData, WEATHER_CACHE_PATH);
            updateWeatherUI(self, weatherData);
        } catch (error) {
            console.error("Error in setupWeather:", error);
            // Fallback to cached data or display an error message
            try {
                const cachedData = JSON.parse(Utils.readFile(WEATHER_CACHE_PATH));
                updateWeatherUI(self, cachedData);
            } catch (cacheError) {
                console.error("Error reading cached weather data:", cacheError);
                updateWeatherUI(self, null); //Display error message
            }
        }
    });
};


const BatteryModule = () => Stack({
    transition: 'slide-up_down',
    transitionDuration: userOptions.animations.durationLarge,
    children: {
        'main': Box({ // Container for both widgets
            className: 'spacing-h-4',
            children: [
                // SWAPPED POSITIONS
                BarGroup({ child: Box({ // Weather widget container - moved to the top
                    hexpand: true,
                    hpack: 'center',
                    className: 'spacing-h-4 txt-onSurfaceVariant',
                    children: [
                        MaterialIcon('device_thermostat', 'small'),
                        Label({ label: 'Weather' }), // Initial Label
                    ],
                    setup: (self) => setupWeather(self),
                })}),
                BarGroup({ child: BarBattery() }), // Battery widget - moved to the bottom
            ]
        }),
    },
    setup: (stack) => {
        stack.shown = 'main'; // Always show both widgets
    }
});

const switchToRelativeWorkspace = async (self, num) => {
    try {
        const Hyprland = (await import('resource:///com/github/Aylur/ags/service/hyprland.js')).default;
        Hyprland.messageAsync(`dispatch workspace ${num > 0 ? '+' : ''}${num}`).catch(error => console.error("Error switching workspace:", error));
    } catch {
        Utils.execAsync([`${App.configDir}/scripts/sway/swayToRelativeWs.sh`, `${num}`]).catch(error => console.error("Error switching workspace:", error));
    }
};

export default () => Widget.EventBox({
    onScrollUp: (self) => switchToRelativeWorkspace(self, -1),
    onScrollDown: (self) => switchToRelativeWorkspace(self, +1),
    onPrimaryClick: () => App.toggleWindow('sideright'),
    child: Widget.Box({
        className: 'spacing-h-4',
        children: [
            BarGroup({ child: BarClock() }),
            BatteryModule(),
        ]
    })
});