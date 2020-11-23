# Chrome Vault Client
A Chrome extension to use passwords stored in a Hashicorp Vault.
* Uses secrets stored in a version 2 KV secrets engine
* Uses secrets having the following properties
  * `url` - URL of the login page (required)
  * `username` - site user ID
  * `email` - email address used for logging into the site
  * `password` - site password
* Populates the login form on the active tab if the page URL matches a stored secret
* Does not store/cache the Vault password
* Does not store/cache `username`, `email` or `password` from a Vault secret

## Extension Permissions
* `activeTab` - used to find and fill in login fields on the current tab when the popup is displayed
* `alarms` - used to refresh the Vault token
* `declarativeContent` - used to enable the extension based on URLs in Vault secrets
* `storage` - used to save/retrieve the extension's settings in local storage
* Optional (requested when the Vault URL is configured)
  * `https://*/*` - used to call the Vault API using a secure connection
  * `http://*/*` - used to call the Vault API using an insecure connection

## Configuration
Before using this extension you must open the options page and provide the Vault login information
(URL, username and password).  The URL and username are saved in Chrome's local storage for future use but
the password is only used to get a Vault token.  After entering the Vault login information, click on the
`Reload URLs` button.  The first time you log in you will be prompted to grant permission for
the extension to access the Vault URL.  Clicking on the `Reload URLs` button will find Vault
secrets having the `url` property with a `username`, `email` and/or
`password` property.  The URLs from the Vault secrets will be listed with the source Vault path(s).  Whenever you
do the following in Vault you will need to use the `Reload URLs` button on the options page to update the list of URLs.
* Add or remove a secret for a login page
* Modify the `url` property of a secret
* Add or remove the `username`, `email` or `password` property of a secret

## URL matching
The `url` property of a Vault secret can use one of the following formats:
* `hostname` - matches any URL for the host
* `https://hostname:port/pathPrefix` - only matches URLs with the specified `port` number and `pathPrefix`

The `port` and and `pathPrefix` are both optional in the second format.

## Using the popup
When the URL of the active tab matches the `url` property of at least one secret the extension's button on the Chrome
toolbar will be enabled.  To fill in the login form, click on the extension's button and then click on one of the buttons
in the popup.  The popup will include a button for each secret that matched the URL in the current tab.  If your Vault
token has expired then you will need to provide your Vault password in the popup so the extension can get a new token.

## Firefox
* Requires enabling CORS on Vault

```sh
vault login ...
vault write /sys/config/cors enabled=true allowed_origins=*
```