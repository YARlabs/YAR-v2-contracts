import { ethers } from "ethers"

async function main() {
    const wallet =  ethers.Wallet.createRandom()
    console.log(wallet.address)
    console.log(wallet.privateKey)
}
main()