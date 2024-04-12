# Run UI

```shell
cd scaffold
```

```shell
yarn install
```

```shell
yarn start
```
 
# Dev environment
ubuntu 22.04
sudo apt-get update
sudo apt-get -y install curl
sudo curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- --default-toolchain nightly -y
sudo apt-get -y install python3 python3-pip
python3 -m pip install mythril
python3 -m pip install slither-analyzer
sudo curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash 
source ~/.nvm/nvm.sh && nvm install --lts
sudo apt-get -y install git
sudo curl -L https://foundry.paradigm.xyz | bash
foundryup