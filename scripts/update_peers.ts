import 'dotenv/config'
import { ethers } from 'ethers'
import { YarBridge20__factory } from '../typechain-types'

async function main() {
  const provider = new ethers.JsonRpcProvider('https://rpc.ankr.com/bsc_testnet_chapel/46ed43307df1caf3e5552edd36e32161b6173775e5c6d08575ad9831af6ecbe8')
  const wallet = new ethers.Wallet(process.env.DEPLOYER!).connect(provider)
    console.log(wallet.address)

    // console.log(await provider.getBalance(wallet.address))
  //   // return
  // await YarBridge20__factory.connect('0x6f19cc3840F07a594A7d081Fb2299CfF19F6B717', wallet).setPeer(
  //   10226688,
  //   '0x3f1c478062B4e970C8AaD72db9F8c19f5fb68901',
  // )
  await YarBridge20__factory.connect('0x6f19cc3840F07a594A7d081Fb2299CfF19F6B717', wallet).setPeer(
    '80002',
    '0x6f19cc3840F07a594A7d081Fb2299CfF19F6B717',
  )
}
main()
