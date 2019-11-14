# webgme-rust

Rust components to use/embed with webgme.

As these components used through webassembly and compilation and those toolchains are still heavily developing,
the rule of thumb is to always check for the versions and make sure the end result is compatible and supported
in the major browsers.

## environment

At the time of creation, these were the steps that was taken to setup a development environment (they might change
with time and some restrictions will hopefully ease):
- the environment requires linux (or windows subsystem for linux 
[WSL](https://docs.microsoft.com/en-us/windows/wsl/install-win10))
- [rustup](https://www.rust-lang.org/learn/get-started) is the required rust toolchain 
```curl https://sh.rustup.rs -sSf | sh```
- when you have rust you need the [latest](https://www.hellorust.com/setup/wasm-target/) and add 
webassembly compile target

```
rustup toolchain install nightly
rustup update
rustup target add wasm32-unknown-unknown --toolchain nightly
cargo install --git https://github.com/alexcrichton/wasm-gc
```

- finally, for easy building you will need 
[wasm-pac](https://github.com/rustwasm/wasm-pack) and 
[wasm-pack-cli](https://rustwasm.github.io/wasm-pack/installer/) 
```curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh```

##build
To build the package content, just run the ```build.sh``` script or give the command
```npm run build```.

##usage

To use the contents of this package, you just have to import it to your project and 
a refer it properly. You have to pay attention the contents of the ```dist``` directory.
It will contain the latest build version so during use you do not need to build it.
It will contain two sub-directories one for client-side usage and one for server-side 
(nodejs).
