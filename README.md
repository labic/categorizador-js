# Categorizador de Texto 

[![N|Solid](http://www.labic.net/wp-content/themes/labicv16/assets/logo-lg.png)](http://www.labic.net/)

# New Features!
  - project SDH

### Installation
requires [Node](https://nodejs.org/en/) v0.12.18 to run.

Install the dependencies and devDependencies and start the service.

clone repo
```sh
$ git clone  https://github.com/labic/categorizador-js
$ cd categorizador-js
```
install dependencies (need sudo)
```sh
$ sudo npm install
```
For production configs...
Edit file settings.json
```sh
$ nano settings.json
```
```json
module.exports = {
    mongouser: "mongouser",
    mongopsw: "mongopsw",
    mongoip: "localhost",
    mongoport: 27017
}
```

to run:

```sh
$ node server_twitter.js 
```
or 

```sh
$ node server_facebook.js 
```
### Stop
```sh
CTRL-C
```
