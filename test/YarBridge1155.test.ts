import { assert, expect, use } from 'chai'
import { deployments, ethers, network } from 'hardhat'
import {
  YarBridge1155,
  YarBridge1155Mock,
  YarBridge1155__factory,
  YarBridge1155Mock__factory,
  BridgedEIP1155,
  BridgedEIP1155__factory,
  YarHub,
  YarHub__factory,
  YarRequest,
  YarRequest__factory,
  YarResponse,
  YarResponse__factory,
  MockERC1155,
  MockERC1155__factory,
} from '../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { BigNumberish } from 'ethers'
import ERC1155Minter from './utils/ERC1155Minter'


describe('YarBridge1155', function () {
    let deployer: SignerWithAddress
    let oracle: SignerWithAddress
    let relayer: SignerWithAddress
    let user: SignerWithAddress
    let user2: SignerWithAddress
    let yarRequest: YarRequest
    let yarResponse: YarResponse
    let yarHub: YarHub
    let yarBridge1155: YarBridge1155
    let yarBridge1155Mock: YarBridge1155Mock
    let bridgedEIP1155: BridgedEIP1155
    let mockERC1155: MockERC1155
    let chainId: BigNumberish

    let initSnapshot: string

    before(async () => {
        await deployments.fixture()
        const signers = await ethers.getSigners()
        deployer = signers[0]
        relayer = signers[1]
        oracle = signers[2]
        user = signers[3]
        user2 = signers[4]

        yarRequest = YarRequest__factory.connect(
            (await deployments.get('YarRequest')).address,
            ethers.provider,
        )
        yarResponse = YarResponse__factory.connect(
            (await deployments.get('YarResponse')).address,
            ethers.provider,
        )
        yarHub = YarHub__factory.connect((await deployments.get('YarHub')).address, ethers.provider)

        yarBridge1155 = YarBridge1155__factory.connect(
            (await deployments.get('YarBridge1155')).address,
            ethers.provider,
        )

        yarBridge1155Mock = YarBridge1155Mock__factory.connect(
            (await deployments.get('YarBridge1155Mock')).address,
            ethers.provider,
        )

        mockERC1155 = MockERC1155__factory.connect(
            (await deployments.get('MockERC1155')).address,
            ethers.provider,
        )

        chainId = (await ethers.provider.getNetwork()).chainId

        await yarBridge1155.connect(deployer).setPeer(111, await yarBridge1155Mock.getAddress())
        await yarBridge1155Mock.connect(deployer).setPeer(chainId, await yarBridge1155.getAddress())

        initSnapshot = await ethers.provider.send('evm_snapshot', [])
    })

    afterEach(async () => {
        await ethers.provider.send('evm_revert', [initSnapshot])
        initSnapshot = await ethers.provider.send('evm_snapshot', [])
    })

    it('Example: bridge 1155', async () => {
        // ---------------------------
        const tokenId = 1;
        const targetChainId = 111;
        const mintBalance = 10;
        const tokenUrl = 'http://localhost:3000';
        // ---------------------------

        // [0] STEP №0
        // Минтим NFT пользователю 1
        await ERC1155Minter.mint(await mockERC1155.getAddress(), user.address, tokenId, mintBalance, tokenUrl);
        assert(await mockERC1155.balanceOf(user.address, tokenId) == BigInt(mintBalance), 'mint!');

        // ---------------------------

        // [1] STEP №1
        // Пользователь вносит депозит

        // сумма токенов в initial сети, которая будет сконвертирована в депозит в Yar
        const depositToYar = ethers.parseEther('1')

        const txDeposit = await yarRequest.connect(user).deposit(depositToYar, { value: depositToYar })

        await expect(txDeposit)
        .to.emit(yarRequest, 'Deposit')
        .withArgs(user.address, ethers.ZeroAddress, depositToYar)

        // ---------------------------

        // [2] STEP №2
        // Relayers получив ивент Deposit из контракта yarRequest
        // Конвертирует feeToken amount к количеству токенов Yar
        const convertedDepositToYar = depositToYar * BigInt(2) // fake convert

        // ---------------------------

        // [3] STEP №3
        // Relayers отправляет транзакцию deposit в YarHub
        // Тем самым зачисляя расчетное(из шага 2) количество токенов на депозит юзера

        // Relayers зачисляет депозит юзеру
        const txDepositYarHub = await yarHub.connect(relayer).deposit(user.address, convertedDepositToYar)

        // Только для тестов
        // Проверяем получение ивента Deposit
        await expect(txDepositYarHub)
        .to.emit(yarHub, 'Deposit')
        .withArgs(user.address, convertedDepositToYar)

        // ---------------------------

        // [4] STEP №4
        // Что бы приложение могло указать пользователя в качестве плательщика комиссии
        // Пользователь должен разрешить приложению списывать баланс

        const approveAmount = ethers.MaxUint256 // сумма которую разрешаем списывать

        // Запрос на разрешение отправляется из intial сети в yarRequest
        const txApprove = yarRequest
        .connect(user)
        .approve(await yarBridge1155.getAddress(), approveAmount)

        // Только для тестов
        // Проверяем получение ивента Approve
        await expect(txApprove)
        .to.emit(yarRequest, 'Approve')
        .withArgs(user.address, chainId, await yarBridge1155.getAddress(), approveAmount)

        // После получения ивента Approve
        // Relayers вызывает транзакцию approve в yarHub
        const txApproveYarHub = yarHub
        .connect(relayer)
        .approve(user.address, chainId, await yarBridge1155.getAddress(), approveAmount)

        // Только для тестов
        // Проверяем получение ивента Approve в yarHub
        await expect(txApproveYarHub)
        .to.emit(yarHub, 'Approve')
        .withArgs(user.address, chainId, await yarBridge1155.getAddress(), approveAmount)

        // Только для тестов
        // Проверяем средства разрешены к списанию
        assert(
        (await yarHub.allowance(user.address, chainId, await yarBridge1155.getAddress())) ==
            approveAmount,
        'approveAmount!',
        )

        // ---------------------------

        // [5] STEP №5
        // Чтобы приложение могло забрать NFT у пользователя, пользователь должен разрешить передачу ERC1155

        const txApproveErc1155 = await mockERC1155.connect(user).setApprovalForAll(
            await yarBridge1155.getAddress(),
            true
        );

        // Только для тестов
        // Проверяем получение ивента Approve в контракте с NFT
        await expect(txApproveErc1155)
            .to.emit(mockERC1155, 'ApprovalForAll')
            .withArgs(user.address, await yarBridge1155.getAddress(), true)

        // Только для тестов
        // Модель транзакции которую Relayers будут доставлять в YarHub и target сеть
        const yarTxTransferTo = await yarBridge1155.connect(user).transferTo.staticCall(
            await mockERC1155.getAddress(),
            tokenId,
            2,
            targetChainId,
            user2.address
        );

        const txTransferTo = await yarBridge1155.connect(user).transferTo(
            await mockERC1155.getAddress(),
            tokenId,
            2,
            targetChainId,
            user2.address
        )
        await txTransferTo.wait();

        const txCreateTransactionTransfer = await yarHub
        .connect(relayer)
        .createTransaction(Object.values(yarTxTransferTo) as any, txTransferTo.hash)
        await txCreateTransactionTransfer.wait();

        const txExecuteTransactionTransfer = await yarHub
        .connect(relayer)
        .executeTransaction(Object.values(yarTxTransferTo) as any, 0)
        await txExecuteTransactionTransfer.wait();

        const txDeliverTransfer = await yarResponse.connect(relayer).deliver(Object.values(yarTxTransferTo) as any)
        await txDeliverTransfer.wait();

        const nftAddress = await yarBridge1155Mock.connect(user).getBridgedTokenAddress(chainId, await mockERC1155.getAddress());

        bridgedEIP1155 = BridgedEIP1155__factory.connect(
            nftAddress,
            ethers.provider,
        )

        assert(await bridgedEIP1155.balanceOf.staticCall(user2.address, tokenId) === 2n, 'Invalid balance on received address');
        assert(await bridgedEIP1155.uri.staticCall(tokenId) === tokenUrl, 'Invalid Url on received address');
        assert(await mockERC1155.balanceOf.staticCall(user.address, tokenId) == 8n, 'Invalid balance after send nft');
    })

    it('Example: bridge 1155 batch', async () => {
        // ---------------------------
        const tokenIds = [1, 2, 3];
        const targetChainId = 111;
        const mintBalance = [10, 20, 30];
        const tokenUrls = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

        // ---------------------------

        // [0] STEP №0
        // Минтим NFT пользователю 1
        await ERC1155Minter.mintBatch(await mockERC1155.getAddress(), user.address, tokenIds, mintBalance, tokenUrls);
        for (let i = 0; i < tokenIds.length; i++) {
            assert(await mockERC1155.balanceOf(user.address, tokenIds[i]) == BigInt(mintBalance[i]), 'mint!');
        }

        // ---------------------------

        // [1] STEP №1
        // Пользователь вносит депозит

        // сумма токенов в initial сети, которая будет сконвертирована в депозит в Yar
        const depositToYar = ethers.parseEther('1')

        const txDeposit = await yarRequest.connect(user).deposit(depositToYar, { value: depositToYar })

        await expect(txDeposit)
        .to.emit(yarRequest, 'Deposit')
        .withArgs(user.address, ethers.ZeroAddress, depositToYar)

        // ---------------------------

        // [2] STEP №2
        // Relayers получив ивент Deposit из контракта yarRequest
        // Конвертирует feeToken amount к количеству токенов Yar
        const convertedDepositToYar = depositToYar * BigInt(2) // fake convert

        // ---------------------------

        // [3] STEP №3
        // Relayers отправляет транзакцию deposit в YarHub
        // Тем самым зачисляя расчетное(из шага 2) количество токенов на депозит юзера

        // Relayers зачисляет депозит юзеру
        const txDepositYarHub = await yarHub.connect(relayer).deposit(user.address, convertedDepositToYar)

        // Только для тестов
        // Проверяем получение ивента Deposit
        await expect(txDepositYarHub)
        .to.emit(yarHub, 'Deposit')
        .withArgs(user.address, convertedDepositToYar)

        // ---------------------------

        // [4] STEP №4
        // Что бы приложение могло указать пользователя в качестве плательщика комиссии
        // Пользователь должен разрешить приложению списывать баланс

        const approveAmount = ethers.MaxUint256 // сумма которую разрешаем списывать

        // Запрос на разрешение отправляется из intial сети в yarRequest
        const txApprove = yarRequest
        .connect(user)
        .approve(await yarBridge1155.getAddress(), approveAmount)

        // Только для тестов
        // Проверяем получение ивента Approve
        await expect(txApprove)
        .to.emit(yarRequest, 'Approve')
        .withArgs(user.address, chainId, await yarBridge1155.getAddress(), approveAmount)

        // После получения ивента Approve
        // Relayers вызывает транзакцию approve в yarHub
        const txApproveYarHub = yarHub
        .connect(relayer)
        .approve(user.address, chainId, await yarBridge1155.getAddress(), approveAmount)

        // Только для тестов
        // Проверяем получение ивента Approve в yarHub
        await expect(txApproveYarHub)
        .to.emit(yarHub, 'Approve')
        .withArgs(user.address, chainId, await yarBridge1155.getAddress(), approveAmount)

        // Только для тестов
        // Проверяем средства разрешены к списанию
        assert(
        (await yarHub.allowance(user.address, chainId, await yarBridge1155.getAddress())) ==
            approveAmount,
        'approveAmount!',
        )

        // ---------------------------

        // [5] STEP №5
        // Чтобы приложение могло забрать NFT у пользователя, пользователь должен разрешить передачу ERC1155

        const txApproveErc1155 = await mockERC1155.connect(user).setApprovalForAll(
            await yarBridge1155.getAddress(),
            true
        );

        // Только для тестов
        // Проверяем получение ивента Approve в контракте с NFT
        await expect(txApproveErc1155)
            .to.emit(mockERC1155, 'ApprovalForAll')
            .withArgs(user.address, await yarBridge1155.getAddress(), true)

        // Только для тестов
        // Модель транзакции которую Relayers будут доставлять в YarHub и target сеть
        const yarTxTransferTo = await yarBridge1155.connect(user).transferToBatch.staticCall(
            await mockERC1155.getAddress(),
            tokenIds,
            [2, 3, 4],
            targetChainId,
            user2.address
        );

        const txTransferTo = await yarBridge1155.connect(user).transferToBatch(
            await mockERC1155.getAddress(),
            tokenIds,
            [2, 3, 4],
            targetChainId,
            user2.address
        )
        await txTransferTo.wait();

        const txCreateTransactionTransfer = await yarHub
        .connect(relayer)
        .createTransaction(Object.values(yarTxTransferTo) as any, txTransferTo.hash)
        await txCreateTransactionTransfer.wait();

        const txExecuteTransactionTransfer = await yarHub
        .connect(relayer)
        .executeTransaction(Object.values(yarTxTransferTo) as any, 0)
        await txExecuteTransactionTransfer.wait();

        const txDeliverTransfer = await yarResponse.connect(relayer).deliver(Object.values(yarTxTransferTo) as any)
        await txDeliverTransfer.wait();

        const nftAddress = await yarBridge1155Mock.connect(user).getBridgedTokenAddress(chainId, await mockERC1155.getAddress());

        bridgedEIP1155 = BridgedEIP1155__factory.connect(
            nftAddress,
            ethers.provider,
        )

        for (let i = 0; i < tokenIds.length; i++) {
            assert(await bridgedEIP1155.balanceOf.staticCall(user2.address, tokenIds[i]) === BigInt([2, 3, 4][i]), 'Invalid balance on received address');
            assert(await bridgedEIP1155.uri.staticCall(tokenIds[i]) === tokenUrls[i], 'Invalid Url on received address');

            assert(
                await mockERC1155.balanceOf.staticCall(user.address, tokenIds[i]) == BigInt(mintBalance[i]) - BigInt([2, 3, 4][i]),
                'Invalid balance after send nft');
        }
    });
})