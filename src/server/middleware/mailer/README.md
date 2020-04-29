## Mail service setup and usage for your WebGME
Here, we collect some example setup and usage guidance related to the e-mail services that made available to your WebGME environment.

### Setup-scenarios
For further information on different setup informations, please check out the [nodemailer](https://nodemailer.com/about/) and [gmeConfig](https://github.com/webgme/webgme-engine/blob/master/config/README.md) descriptions.
#### Gmail
Probably the easiest way to drive your e-mail services is to connect it to a gmail account. Just follow these steps and you should be good to go:
- Go to your [google account](https://myaccount.google.com/) and make sure that among the security settings you turn on the `Less secure app access` - otherwise google will block your login attempts.
- Edit your WebGME configuration of your app (usually, you want to edit the `./config/config.default.js`):
```
config.mailer.enable = true; 
config.mailer.service = 'gmail';
config.mailer.user = 'mySpecial@gmail.com';
config.mailer.pwd = 'myVerySecretPassword';
```
That is it. This activates your mailing servcices! Do not be afraid that you store your login and password this way as no one can access these informations on the WebGME server, however MAKE SURE THAT YOU ONLY SET THIS INFORMATION ON A SECURE SERVER AND THAT IT DOES NOT TRAVEL THE WORLD WIDE WEB IN UNENCRYPTED FORM!
#### Basic SMTP server
Another easy and widely used configuraiton is a simple SMTP server. When you create your WebGME deployment via docker container, you might want to use a [dockerized smtp](https://hub.docker.com/r/namshi/smtp), but any SMTP that you can gain access to should work. The following elements should be added to your configuration file:
```
config.mailer.enable = true; 
config.mailer.host = 'ipAddressOfMySMTPServer';
config.mailer.port = 25 /* the port where WebGME can login to my SMTP server */;
config.mailer.user = 'mySpecialUserName';
config.mailer.pwd = 'myVerySecretPassword';
```
### Usage
As we setup our mailer service, here are some ways how you can use it.
#### Password reset
Accidents happen and so far, the only way to give a user a new password in this case was to contact the maintainer of the deployment who was able to set some password using the built-in [usermanager](https://github.com/webgme/webgme-engine/blob/master/src/bin/usermanager.js#L126-L147) command. Now, with careful setup the default [profile page](https://github.com/webgme/user-management-page) can provide a 'reset' functionality to the user, that is combined with the mailer service. The following elements of your configuration must be set on top of the [basic mailer settings](#Setup-scenarios):
```
config.authentication.allowPasswordReset = true; /* to allow reset functionality */
config.authentication.allowedResetInterval = 3600000; /* interval of allowed reset requests that should be long enough so malicious actors cannot abuse it */
config.authentication.resetTimeout = 1200000; /* time interval while the user is allowed to change her/his password */
config.authentication.resetUrl = '/profile/reset'; /* the page that will handle the reset request - embedded in a user e-mail - the actual format will be /profile/reset/userName/resetId in case you want to create your own solution */
config.mailer.sendPasswordReset = true; /* this flag ensures that an e-mail will be sent to the user with the proper reset link */
```
#### Middleware mail service
Once the mailing serivce is [setup](#Setup-scenarios), any middleware implementation can use it. [REST routers](https://github.com/webgme/webgme/wiki/REST-Routers) will recive a mailer-object in the middleware options (or null if mailer is not available). The currently available functions:
- send: low level message sending function allowing to compose e-mails to any recipient (not able to send to multiple addressees)
- passwordReset: special password reset email that uses the `userName` and the `resetHash` as input paramters to generate a link and email content that will be sent to the user's address.
