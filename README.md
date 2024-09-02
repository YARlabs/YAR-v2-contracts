# YarLib

An auxiliary library that stores common code. It is used in YarRequest, YarResponse, YarHub and can be used by third-party applications.

```solidity
library YarLib {
    // A model with all the data of a cross-chain transaction
    struct YarTX {
        uint256 initialChainId; // sending network
        address sender; // who pays the fee in YarHub
        address app; // who sent the request in YarRequest
        uint256 targetChainId; // destination network
        address target; // address to which [value] will be sent and [data] will be executed
        uint256 value; // how many native tokens to send to the [target] address
        bytes data; // 0x or encoded function call
        uint256 depositToYarAmount; // the amount of fees sent with the transaction, could be 0 if the user already had a deposit
    }
}
```

# YarRequest

Deployed in each network, including YarChain.

```solidity
interface YarRequest {
    // Event based on which the pending transaction is added to YarHub
    event Send(
        YarLib.YarTX yarTx // Cross-chain transaction model
    );

    // Event based on which the balance for paying fees is credited to the [depositor]'s account in YarHub
    event Deposit(
        address depositor, // who to credit
        address feesToken, // payment token in the initial network
        uint256 amount // amount of feesToken accepted as payment
    );

    // Address of the multisig wallet to which funds will be transferred to pay the deposit
    function relayer() external view returns(address);

    // Token accepted as payment of fees
    // If feeToken == address(0), it is the native token of the current network
    function feeToken() external view returns(address);

    // Checks whether [sender] allowed the transaction [yarTxHash] to be sent from the [app] address
    function approvals(
        address sender, // who will pay the fee
        address app, // who initiates the transaction
        bytes32 yarTxHash // hash generated from YarLib.YarTX
    ) external view returns(bool);

    // Used to top up the deposit in YarHub
    // Payment is made in the current feeToken
    function deposit(
        address account, // whose account to credit
        uint256 amount // how much feeToken was accepted in the initial network
    ) external payable;

    // This function allows in one transaction
    // to issue approval and call an application that
    // can perform a cross-chain transaction on behalf of the user
    function approveAndCallApp(
        bytes calldata appData, // encoded function call to be executed at yarTX.app address
        YarLib.YarTX calldata yarTX // cross-chain transaction to which permission will be granted, from yarTX.sender to yarTX.app
    ) external payable;

    // Grants permission for [yarTX.app] to send the transaction [yarTX], which will be paid by [yarTX.sender]
    function approve(YarLib.YarTX calldata yarTX) external;

    // Send a cross-chain transaction from the [yarTx.app] address, which will be paid by [yarTx.sender]
    function sendFrom(YarLib.YarTX calldata yarTX) external payable;

    // Calls _approve if
    // the signature matches the [yarTX.sender]'s signature
    function permit(
        YarLib.YarTX calldata yarTX,
        uint256 signatureExpired,
        bytes calldata signature
    ) external;

    // Sends a cross-chain transaction
    // where msg.sender == yarTX.sender == yarTx.app
    function send(YarLib.YarTX calldata yarTX) external payable;
}
```

# YarResponse

Deployed in each network, including YarChain.

```solidity
interface YarResponse {
    // Address of the multisig wallet to which funds will be transferred to pay the deposit
    function relayer() external view returns(address);

    // Getter that temporarily stores the current executing transaction
    // It is set before calling the target and cleared afterward
    function trustedYarTx() external view returns(YarLib.YarTX);

    // Can only be called from the [relayer] address
    // Transaction delivery in the target network
    function deliver(YarLib.YarTX calldata yarTx) external payable;
}
```

# YarHub

Deployed only on the YAR network.

```solidity
interface YarHub {
    // Auxiliary data type for denoting the transaction status
    enum TxStatus {
        NotExists, // Transaction does not exist
        WaitForPay, // Waiting for deposit top-up
        InProgress, // Deposit is locked, and the transaction is handed over to YarResponse for execution
        Completed, // Transaction completed successfully, deposit unlocked
        Rejected // Transaction ended with an error, deposit unlocked
    }

    // Wrapped YarLib.YarTX with additional fields used only in YarHub
    struct WrappedYarTX {
        YarLib.YarTX yarTx; // Transaction model
        TxStatus status; // Current status
        uint256 lockedFees; // Amount locked from the sender's deposit. Set after execute
        uint256 usedFees; // Amount of fees spent. Set after commit
        bytes32 initialTxHash; // Hash of the transaction that initiated the transfer in the initial network
        bytes32 targetTxHash; // Hash of the transaction in the target network
    }

    // Event with the same name as the function
    event CreateTransaction(YarLib.YarTX yarTx);

    // Event with the same name as the function
    event ExecuteTransaction(YarLib.YarTX yarTx);

    // Triggered when the transaction has been sent to the target network and completed
    // successfully, then status = TxStatus.Completed
    // or with an error, then status = TxStatus.Rejected
    event CommitTransaction(YarLib.YarTX yarTx, TxStatus status, uint256 usedFees, uint256 feesToReturn);

    // Event with the same name as the function
    event Deposit(
        address account, // whose account was credited
        uint256 amount // amount of fee tokens credited
    );

    // Called from the relayer address
    // If there was a deposit top-up event from the initial network,
    // this function must be called before executeTransaction
    // Otherwise, the second will fail with "feeTokensToLock!"
    // Credits [feeTokenAmount] tokens to the [account]'s balance
    function deposit(address account, uint256 feeTokenAmount) external;

    // Called from the relayer address
    // Adds a new transaction to memory
    // The status of the new transaction is WaitForPay
    // lockedFees - 0
    // usedFees - 0
    // initialTxHash = initialTxHash - hash of the transaction in the initial network
    function createTransaction(YarLib.YarTX calldata yarTX, bytes32 initialTxHash) external;

    // Called from the relayer address
    // If the transaction has not been created before, an error "only WaitForPay!" occurs
    // The parameter feeTokensToLock is a calculated amount, with a reserve, which will be temporarily deducted from the user's balance
    // if deposits[yarTX.sender] funds are less than feeTokensToLock, the transaction will fail with "feeTokensToLock!"
    // If the deposit is successfully deducted, emits the ExecuteTransaction event,
    // based on which the transaction must be delivered to the target network
    function executeTransaction(YarLib.YarTX calldata yarTX, uint256 feeTokensToLock) external;

    // Called from the relayer address
    // After successfully completing a transaction in the target network, sets the status to TxStatus.Completed
    // It is required to specify usedFees - the amount that can ultimately be deducted from the user's account
    // If usedFees exceed locked funds, nothing is returned
    // Otherwise, credits the difference to the user's balance
    function completeTransaction(YarLib.YarTX calldata yarTX, bytes32 targetTxHash, uint256 usedFees) external;

    // Called from the relayer address
    // After a transaction error in the target network, sets the status to TxStatus.Rejected
    // It is required to specify usedFees - the amount that can ultimately be deducted from the user's account
    // If usedFees exceed locked funds, nothing is returned
    // Otherwise, credits the difference to the user's balance
    function rejectTransaction(YarLib.YarTX calldata yarTX, bytes32 targetTxHash, uint256 usedFees) external;
}
```


### Basic Algorithm:

1. **YarRequest** emits the following events:
   - `Deposit(address depositor, address feesToken, uint256 amount)`
   - `Send(YarLib.YarTX yarTx)`

2. **Relayers** must first process the deposits, recalculating the `feesToken` and `amount` into `feeTokenAmount` of the Yar network.

3. After recalculation, they send transactions:
   - `YarHub.connect(relayer).deposit(depositor, feeTokenAmount)`

4. Then, Relayers start processing the `Send` events:
   - First, sending transactions that create pending transactions:
     - `YarHub.connect(relayer).createTransaction(yarTx)`

5. Then, the required fee amount is recalculated again but now for Yar tokens, and passed as `feeTokensToLock`:
   - `YarHub.connect(relayer).executeTransaction(yarTx, feeTokensToLock)`

6. If the user has sufficient funds, the event triggers:
   - `ExecuteTransaction(YarLib.YarTX yarTx)`
   - Based on this event, the transaction can be delivered to the target network.
   - If funds are insufficient, the transaction will fail with the error "feeTokensToLock!"

7. After the `ExecuteTransaction` event and its execution, the final fee expenditure is calculated and passed on as `usedFees`. Depending on how the transaction executed, the Relayer network sends either:
   - `YarHub.connect(relayer).completeTransaction(yarTx, usedFees)`
   - or
   - `YarHub.connect(relayer).rejectTransaction(yarTx, usedFees)`

---

### Run UI

```shell
cd scaffold
```

```shell
yarn install
```

```shell
yarn start
```

---

### Dev Environment Setup

1. Use Ubuntu 22.04:
   
```shell
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
```