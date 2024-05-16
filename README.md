# Chrome Vault Client
A Chrome extension for using passwords stored in a Hashicorp Vault.
* Uses secrets stored in a version 2 KV secrets engine
* Uses secrets having one of the following properties
  * `url`
  * `site url`
* Populates the login form on the active tab if the page URL matches
  the URL (hostname or domain) of a stored secret
* Does not store/cache the Vault password
* Does not store/cache values from a Vault secret (except the URL)

## Extension Permissions
* `activeTab` - used to find and fill in login fields on the current tab when the popup is displayed
* `alarms` - used to refresh the Vault token
* `declarativeContent` - used to enable the extension based on URLs in Vault secrets (Chrome)
* `storage` - used to save/retrieve the extension's settings in local storage
* Optional (requested when the Vault URL is configured)
  * `https://*/*` - used to call the Vault API using a secure connection
  * `http://*/*` - used to call the Vault API using an insecure connection

## Configuration
Before using this extension you must open the options page and provide the Vault login information
(URL, username and password).  The URL and username are saved in the browser's local storage for future use but
the password is only used to get a Vault token.  After entering the Vault login information, click on the
`Reload URLs` button.  The first time you log in you will be prompted to grant permission for
the extension to access the Vault URL.  Clicking on the `Reload URLs` button will find Vault
secrets having the `url` or `site url` property .  The URLs from the Vault secrets will
be listed with the source Vault path(s).  Whenever you
do the following in Vault you will need to use the `Reload URLs` button on the
popup or options page to update the list of URLs.
* Add or remove a secret for a login page
* Modify the `url` or `site url` property of a secret

## URL matching
The `url` property of a Vault secret can use one of the following formats.
* `hostname` - matches any URL for the host
* `https://hostname:port/pathPrefix`

The `port` and and `pathPrefix` are both optional in the second format.

## Using the popup
To fill in the login form, click on the extension's button and then click on one of the buttons
in the popup.  The popup will include a button for each secret that matched the URL in the current tab.
The popup also includes an input for each property of the Vault secret.  These inputs are used to select
the input on the page to be populated with the value from the Vault secret.
If your Vault token has expired then you will need to provide your Vault password in the popup so
the extension can get a new token.

## Firefox
* Requires enabling CORS on Vault

```sh
vault login ...
vault write /sys/config/cors enabled=true allowed_origins=*
```
