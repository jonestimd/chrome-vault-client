# Chrome Vault Client
A Chrome extension to use passwords stored in a Hashicorp Vault.
* Uses secrets stored in a version 2 KV secrets engine
* Uses secrets having the following properties
  * `url` - URL of the login page (required)
  * `username` - site user ID
  * `password` - site password
* Populates the login form on the active tab if the page URL matches a stored secret
* Does not store/cache the Vault password
* Does not store/cache `username` or `password` from a Vault secret

## Configuration
Before using this extension you must open the options page and provide the Vault login information
(URL, username and password).  The URL and username are saved in Chrome's local storage for future use but
the password is only used to get a Vault token.  After entering the Vault login information, click on the
`Login` button to get a token.  You will be prompted to grant permission for the extension to access the Vault URL.
After logging in, click on the `Reload` button to find Vault secrets having the `url` property.  The user icon to the
right of a URL indicates that there is also a `username` and/or `password` property on the Vault secret.  Whenever you
do the following in Vault you will need to use the `Reload` button on the options page to update the list of URLs.
* Add or remove a secret for a login page
* Modify the `url` property of a secret
* Add or remove the `username` or `password` property of a secret

## URL matching
The `url` property of a Vault secret can use one of the following formats:
* `hostname` - matches any URL for the host
* `https://hostname:port/pathPrefix` - only matches URLs with the specified `port` number and `pathPrefix`

The `port` and and `pathPrefix` are both optional in the second format.

## Using the popup
When the URL of the active tab matches the `url` property of a secret the extension's button will be enabled.
To fill in the login form, click on the extension's button and then click on one of the buttons in the popup.
The *user* button will only fill in the username.  The *key* button will only fill in the password.  The *input* button
will fill in both the username and password.  The buttons are only enabled if the corresponding input is found on
the page.  If your Vault token has expired then you will need to provide your Vault password in the popup to get
a new token.
