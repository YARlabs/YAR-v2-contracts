# YarLib

A helper library that stores common code.  
Used in YarRequest, YarResponse, YarHub. It can also be used by third-party applications.

```solidity
library YarLib {
    // Model containing all data for cross-chain transactions
    struct YarTX {
        uint256 initialChainId; // Sending network
        address sender; // Who pays the fee in YarHub
        address app; // Who sent the request to YarRequest
        uint256 targetChainId; // Delivery network
        address target; // The address to which [value] will be transferred and [data] executed
        uint256 value; // How many native tokens to send to the [target] address
        bytes data; // 0x or encoded function call
        uint256 depositToYarAmount; // The number of fees sent with the transaction, can be 0 if the user already has a deposit
    }
}
```

# YarRequest

Deployed in each network, including YarChain.

```solidity
interface YarRequest {
    // Event based on which a pending transaction is added to YarHub
    event Send(
        YarLib.YarTX yarTx // Cross-chain transaction model
    );

    // Event based on which the balance for commission payments is credited to the [depositor]'s account in YarHub
    event Deposit(
        address depositor, // To whom it will be credited
        address feesToken, // Payment token in the initial network
        uint256 amount // Number of feesToken accepted as payment
    );

    // Address of the multisig wallet where funds for deposit payment will be transferred
    function relayer() external view returns(address);

    // Token accepted as a commission payment
    // If feeToken == address(0), it is the native token of the current network
    function feeToken() external view returns(address);

    // Checks if [sender] has allowed the transaction [yarTxHash] to be sent from the [app] address
    function approvals(
        address sender, // Who will pay the commission
        address app, // Who initiates the transaction
        bytes32 yarTxHash // Hash obtained from YarLib.YarTX
    ) external view returns(bool);

    // Used to replenish the deposit in YarHub
    // Payment is made in the current feeToken
    function deposit(
        address account, // Whose account to credit
        uint256 amount // How much feeToken was accepted in the initial network
    ) external payable;

    // This function allows for one transaction
    // To grant approval and call an application that
    // Can perform a cross-chain transaction on behalf of the user
    function approveAndCallApp(
        bytes calldata appData, // Encoded function call that will be executed at the yarTX.app address
        YarLib.YarTX calldata yarTX // Cross-chain transaction that will be approved, from yarTX.sender to yarTX.app
    ) external payable;

    // Allows the application [yarTX.app] to send the transaction [yarTX], which will be paid by [yarTX.sender]
    function approve(YarLib.YarTX calldata yarTX) external;

    // Send a cross-chain transaction from the address [yarTx.app], which will be paid by [yarTx.sender]
    function sendFrom(YarLib.YarTX calldata yarTX) external payable;

    // Calls _approve if
    // signature matches the signature of [yarTX.sender]
    function permit(
        YarLib.YarTX calldata yarTX,
        uint256 signatureExpired,
        bytes calldata signature
    ) external;

    // Sends a cross-chain transaction
    // Where msg.sender == yarTX.sender == yarTx.app
    function send(YarLib.YarTX calldata yarTX) external payable;
}
```

# YarResponse

Deployed in each network, including YarChain.

```solidity
interface YarResponse {
    // Address of the multisig wallet where funds for deposit payment will be transferred
    function relayer() external view returns(address);

    // Getter where the currently executing transaction is temporarily stored
    // It is set before calling the target and cleared afterward
    function trustedYarTx() external view returns(YarLib.YarTX);

    // Can only be called from the [relayer] address
    // Delivery of the transaction in the target network
    function deliver(YarLib.YarTX calldata yarTx) external payable;
}
```

# YarHub

Deployed only in the YAR network.

```solidity
interface YarHub {
    // Helper data type to indicate the status of a transaction
    enum TxStatus {
        NotExists, // Transaction does not exist
        WaitForPay, // Waiting for deposit replenishment
        InProgress, // Deposit is locked, and the transaction is passed for execution in YarResponse
        Completed, // Transaction completed successfully, deposit unlocked
        Rejected // Transaction ended with an error, deposit unlocked
    }

    // Wrapped YarLib.YarTX with additional fields used only in YarHub
    struct WrappedYarTX {
        YarLib.YarTX yarTx; // Transaction model
        TxStatus status; // Current status
        uint256 lockedFees; // Amount locked from the sender's deposit. Set after execution
        uint256 usedFees; // Amount of fees spent. Set after commit
        bytes32 initialTxHash; // Hash of the transaction that initiated the transfer in the initial network
        bytes32 targetTxHash; // Hash of the transaction in the target network
    }

    // Event with the same name as the function
    event CreateTransaction(YarLib.YarTX yarTx);

    // Event with the same name as the function
    event ExecuteTransaction(YarLib.YarTX yarTx);

    // Fires when the transaction has been sent to the target network and completed
    // Either successfully, then status = TxStatus.Completed
    // Or with an error, then status = TxStatus.Rejected
    event CommitTransaction(YarLib.YarTX yarTx, TxStatus status, uint256 usedFees, uint256 feesToReturn);

    // Event with the same name as the function
    event Deposit(
        address account, // To whose account credited
        uint256 amount // How many commission tokens were credited
    );

    // Called from the relayer address
    // If there was a deposit replenishment event from the initial network,
    // Then this function must be called before executeTransaction
    // Otherwise, the latter will fail with the error "feeTokensToLock!"
    // Credits [feeTokenAmount] tokens to the balance [account]
    function deposit(address account, uint256 feeTokenAmount) external;

    // Called from the relayer address
    // Adds a new transaction to memory
    // The status of the new transaction is WaitForPay
    // lockedFees - 0
    // usedFees - 0
    // initialTxHash = initialTxHash - transaction hash in the initial network
    function createTransaction(YarLib.YarTX calldata yarTX, bytes32 initialTxHash) external;

    // Called from the relayer address
    // If the transaction was not created before, an error "only WaitForPay!" will occur
    // The parameter feeTokensToLock is an estimated number, with a reserve, that will be temporarily deducted from the user's balance
    // If the balance of deposits[yarTX.sender] is less than feeTokensToLock, the transaction will fail with the error "feeTokensToLock!"
    // If the deposit is successfully deducted, emits an ExecuteTransaction event,
    // Based on which the transaction should be delivered to the target network
    function executeTransaction(YarLib.YarTX calldata yarTX, uint256 feeTokensToLock) external;

    // Called from the relayer address
    // After successfully completing the transaction in the target network, sets the status to TxStatus.Completed
    // You must specify usedFees - how much can ultimately be deducted from the user's account
    // If usedFees exceeds locked funds, nothing is returned
    // Otherwise, the difference is credited to the user's balance
    function completeTransaction(YarLib.YarTX calldata yarTX, bytes32 targetTxHash, uint256 usedFees) external;

    // Called from the relayer address
    // After a transaction error in the target network, sets the status to TxStatus.Rejected
    // You must specify usedFees - how much can ultimately be deducted from the user's account
    // If usedFees exceeds locked funds, nothing is returned
    // Otherwise, the difference is credited to the user's balance
    function rejectTransaction(YarLib.YarTX calldata yarTX, bytes32 targetTxHash, uint256 usedFees) external
}
```

Basic Algorithm:

YarRequest -> emit Deposit(address depositor, address feesToken, uint256 amount)  
-> emit Send(YarLib.YarTX yarTx)

Relayers should first process deposits, recalculating feesToken and amount to the Yar network feeTokenAmount.  
After that, send transactions:  
YarHub.connect(relayer).deposit(depositor, feeTokenAmount)

Then the Relayers start processing Send events:  
First, sending transactions that will create pending transactions  
YarHub.connect(relayer).createTransaction(yarTx)

Next, the required amount of fees is recalculated for Yar tokens and passed as feeTokensToLock  
YarHub.connect(relayer).executeTransaction(yarTx, feeTokensToLock)

If the user had enough funds, the event will trigger  
-> emit ExecuteTransaction(YarLib.YarTX yarTx)  

Based on which the transaction can be delivered to the target network  
But if funds are insufficient, the transaction will fail with the error "feeTokensToLock!"

After the ExecuteTransaction event and its execution, the final commission expense is calculated and passed on as “usedFees”.
Depending on how the transaction was executed, the Relayer network sends either:
YarHub.connect(relayer).completeTransaction(yarTx, usedFees)
or
YarHub.connect(relayer).rejectTransaction(yarTx, usedFees)

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
