import App from 'resource:///com/github/Aylur/ags/app.js';
import Widget from 'resource:///com/github/Aylur/ags/widget.js';
import Brightness from '../../../services/brightness.js';
import Indicator from '../../../services/indicator.js';

// Removed Hyprland import - no longer needed
const WindowTitle = async () => {
    try {
        return Widget.Scrollable({
            hexpand: true, vexpand: true,
            hscroll: 'automatic', vscroll: 'never',
            child: Widget.Box({
                vertical: true,
                children: [
                    // Top label remains
                    Widget.Label({
                        xalign: 0,
                        label: 'Arch Linux / Hyprland',
                        className: 'txt-smaller bar-wintitle-topdesc txt',
                    }),
                    // Removed:  Application and workspace labels
                    // These two lines were removed.
                    Widget.Label({
                        xalign: 0,
                        label: 'nnetherr@acedia',
                        className: 'txt-smaller bar-wintitle-bottomdesc txt',
                    }),
                ]
            })
        });
    } catch (error) {
        console.error("Error in WindowTitle:", error); // Improved error handling
        return null;
    }
};


export default async (monitor = 0) => {
    const optionalWindowTitleInstance = await WindowTitle();
    return Widget.EventBox({
        onScrollUp: () => {
            Indicator.popup(1);
            Brightness[monitor].screen_value += 0.05;
        },
        onScrollDown: () => {
            Indicator.popup(1);
            Brightness[monitor].screen_value -= 0.05;
        },
        onPrimaryClick: () => {
            App.toggleWindow('sideleft');
        },
        child: Widget.Box({
            homogeneous: false,
            children: [
                Widget.Box({ className: 'bar-corner-spacing' }),
                Widget.Overlay({
                    overlays: [
                        Widget.Box({ hexpand: true }),
                        Widget.Box({
                            className: 'bar-sidemodule', hexpand: true,
                            children: [Widget.Box({
                                vertical: true,
                                className: 'bar-space-button',
                                children: [
                                    optionalWindowTitleInstance,
                                ]
                            })]
                        }),
                    ]
                })
            ]
        })
    });
};
