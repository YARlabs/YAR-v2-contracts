import { ethers } from 'ethers'
import { YarEcho__factory } from '../typechain-types'


async function main() {
  const oracle = new ethers.Wallet(
    '',
  )

  const initialChainId = 80001 
  const targetChainId = 43113
  const target = '0x9a56Bd6f70069a10ff5Db6e8a4CDd991842EFA03'

  const message = 'Hello!'
  const feeAmount = 5
  const feeSignatureExpired = 1722664103
  const feeSignature = await oracle.signMessage(
    ethers.getBytes(
      ethers.solidityPackedKeccak256(
        ['uint256', 'uint256', 'address', 'bytes', 'uint256', 'uint256'],
        [
          initialChainId,
          targetChainId,
          target,
          YarEcho__factory.createInterface().encodeFunctionData('receiveMessage', [message]),
          feeAmount,
          feeSignatureExpired,
        ],
      ),
    ),
  )
  console.log(feeSignature)
}
main()