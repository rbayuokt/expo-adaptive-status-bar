const { withInfoPlist } = require('expo/config-plugins')

/**
 * iOS sets the style app-wide, which needs UIViewControllerBasedStatusBarAppearance = NO. That is
 * already the Expo default, the plugin only matters if something set it to YES.
 */
module.exports = function withAdaptiveStatusBar(config) {
  return withInfoPlist(config, (c) => {
    c.modResults.UIViewControllerBasedStatusBarAppearance = false
    return c
  })
}
