# Picture generator UI

Successor to a Discord bot that did the same thing.  

## Install

Install NodeJS, at least 16 LTS. More recent will probably work too.  
Run `npm install` in the root directory of the bot.

## Configure

Copy config example from `config.example.json` and start editing.  
Here I will go over non-trivial configuration parameters. Some of them are self-explanatory and won't be mentioned here.  

`discordClientSecretFile`, `discordClientId` - this app authorizes users through Discord API. So it needs an client ID and secret to properly call the Discord server. You can get those values from OAuth2 tab on Discord developer portal. Don't forget to put proper redirect URL in the same tab! For this app, it's something like `http://localhost:22650/api/discordOauth2` - with your domain and protocol. This value will be specific for your app install.  
`httpHost` - if specified, server will listen only on this interface (i.e. if `localhost` is passed - server won't listen to external interfaces). If not specified (property deleted from config), server will listen to all available network interfaces.  
`haveHttps` - set to `true` if your install of app will be available over HTTPS and not plain HTTP. It affects URLs that are generated on server-side to redirect user around. Server does not support HTTPS as protocol, but can be put behind reverse-proxy that does HTTPS for him (for example).  

## Run

Start with command `node server.js`  
After start, app will listen to HTTP requests on port specified in config.  
Server can be shut down gracefully with `SIGINT` (Ctrl+C).  
