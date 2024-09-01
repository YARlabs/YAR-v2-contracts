# Documentation

## Protocol

The YAR protocol implements a network for delivering on-chain transactions to external networks.
<br>
It consists of the following elements:

0. A standard EVM transaction that needs to be delivered
1. The `YarRequest` smart contract, which serves as the entry point
2. The `YarResponse` smart contract, responsible for on-chain transaction delivery
3. The `YarHub` smart contract, located only in YarChain, represents a mempool of cross-chain transactions
4. The Solidity structure `YarLib.YarTX`, a wrapper around a standard EVM transaction with additional metadata
5. The EVM-compatible blockchain YarChain
6. A network of validators known as Relayers

These elements are combined in the following sequence:

1. The initiator (EOA wallet or smart contract) calls `YarRequest.send(...)`
2. `YarRequest` generates a `Send` event
3. Upon receiving the `Send` event, Relayers add the pending transaction to `YarHub`
4. After adding the transaction to the queue, Relayers move transactions into execution, locking a sufficient amount of fees
5. Relayers call `YarResponse.deliver(...)`, which executes the transaction to the destination address
6. After executing the transaction, Relayers update the transaction status and return any unspent fees

### 0. Standard EVM Transaction

There are no restrictions on the transactions being sent:

1. The address in the external network does not need to conform to any specific interface; transactions can be delivered even to EOA wallets
2. The transaction can transfer the native token, i.e., use the [value] parameter
3. The transaction can represent another cross-chain call, allowing complex sequences of data transfers across multiple networks

### 1. `YarRequest` Smart Contract

The starting point of the protocol.
It is responsible for sending events to validators.

There are 3 types of unique events:

1. `Send` - sends a cross-chain transaction

```solidity
event Send(
    YarLib.YarTX yarTx
);
```

2. `Deposit` - replenishes the balance, which is debited to pay for cross-chain transactions

```solidity
event Deposit(
    address depositor,
    address feesToken,
    uint256 amount
);
```

3. `Approve` - similar to `EIP20.approve`. Allows applications to debit the user's balance to pay for their cross-chain transaction

```solidity
event Approve(
    address account,
    uint256 initialChainId,
    address spender,
    uint256 amount
);
```

Each event corresponds to a function of the same name:

1. `send` - accepts `YarLib.YarTX` and sends it to the Relayers network

```solidity
function send(YarLib.YarTX memory yarTX) external returns (YarLib.YarTX memory);
```

2. `deposit` - accepts tokens (native or EIP20) from the user

```solidity
function deposit(uint256 amount) public payable;
```

3. `approve` - allows the [spender] to debit [amount] YarToken from the user's deposit

```solidity
function approve(address spender, uint256 amount) public;
```

### 2. `YarResponse` Smart Contract

Acts as the entry point for sending transactions by the Relayers network. This is done via the `deliver` function, which deploys the cross-chain transaction [yarTx] and delivers it to the recipient.

```solidity
function deliver(YarLib.YarTX calldata yarTx) external payable {
    ...
    yarTx.target.call{ value: yarTx.value }(yarTx.data);
    ...
}
```

Additionally, this smart contract is used by applications for authorization if their recipient function should only accept calls from Relayers and not any address.

Temporarily, it stores the metadata of the current cross-chain transaction, which can be accessed in the `trustedYarTx` function. The metadata is recorded before the call and deleted immediately afterward.

```solidity
function trustedYarTx() external view returns (YarLib.YarTX memory);
```

!!! Passing flags to enable/disable writing `trustedYarTx` fields to storage can save gas.

Here's the English translation of the provided Russian text, with a focus on maintaining programming terminology:

---

### 3. `YarHub` Smart Contract

`YarHub` stores all pending, executed, and unexecuted cross-chain transactions, which are accessible in the `wrappedYarTXs` mapping.

```solidity
function wrappedYarTXs(bytes32 yarTxHash) external view returns (WrappedYarTX);
```

To access a specific transaction `[yarTx]`, the key used is the keccak hash of the entire `YarLib.YarTx` model.

```solidity
keccak256(abi.encode(yarTX))
```

You can also obtain the identifying hash of a cross-chain transaction using the `[YarHub.getYarTxHash]` method.

```solidity
function getYarTxHash(YarLib.YarTX calldata yarTX) public pure returns (bytes32);
```

`YarHub` also stores user deposits in Yar tokens, which are used to pay for transaction fees.
<br>
The balance is credited to the deposit only from the relayer’s address after processing the `Deposit` event.
<br>
To view the current balance:

```solidity
uint256 balance = yarHub.deposits(account);
```

### 4. Solidity Structure `YarLib.YarTX`

```solidity
library YarLib {
    struct YarTX {
        uint256 initialChainId; // Identifier of the current network
        address sender; // Your smart contract [Example]
        address payer; // User who calls the Example contract and pays the fee in Yar
        uint256 targetChainId; // Identifier of the network where the transaction will be delivered
        address target; // Address in the [TARGET] network where the transaction will be called
        uint256 value; // Amount of the native token of the [TARGET] network that will be sent with the transaction
        bytes data; // Encoded transaction data (bytes4 for the function signature + function arguments)
        uint256 _nonce; // This parameter will be redefined in YarRequest; set it to 0
    }
}
```

## Fees

To pay for gas in the delivery network, the protocol charges a sufficient amount in Yar tokens from the user's balance, stored on the YarHub smart contract in the Yar network.
<br>
For the Relayers network to execute the transaction, the user must first deposit a sufficient amount.
<br>
If the user does not have a sufficient deposit at the time of transaction execution, the transaction will remain in the queue.
<br>
This is done by calling the `deposit` function on the `YarRequest` smart contract from any supported network.

```solidity
yarRequest.deposit(amount);
```

Each network uses its own payment token, usually the native token of the network, but it can also be an EIP20 token.
<br>
To see which token is used:

```solidity
address feeToken = yarRequest.feeToken();
```

If `feeToken == address(0)`, the native token of the network is used; otherwise, the specified EIP20 token is used.
<br>

For example, by calling `YarRequest.deposit(1e18)` on the Ethereum network, 1 ETH will be debited from the user's wallet, which will then be converted at the current rate into YAR tokens and credited to the user's deposit in `YarHub`.

<br>

To perform cross-chain transactions from the address of any smart contract but pay the Yar fee from the user's address, the user must allow the application to debit the deposit on their behalf.

```solidity
yarRequest.approve(appAddress, yarAmount);
```

## Use Cases

The YAR protocol allows sending arbitrary transactions to any address, whether it's a smart contract or an EOA wallet.

### Sending Transactions to an EOA Wallet

Such transactions usually only make sense when transferring the native token of the network, the amount of which is specified in the `value` parameter.

For example, a standard transaction within one network:

```solidity
sender.sendTransaction({
  from: sender.address, // sender
  to: recipient.address, // recipient
  value: 1e18, // amount of funds sent
})
```

To deliver a similar transaction to another network, it looks like this:

```solidity
yarRequest.send({
  initialChainId,
  sender: sender.address, // sender
  payer: sender.address, // sender
  targetChainId,
  target: recipient.address, // recipient
  value: 1e18, // amount of funds sent
  data: '0x',
  _nonce: 0,
})
```

After executing this transaction, the Relayers network will transfer 1e18 of the target network's native tokens to the recipient's address.

### Sending Transactions to a Smart Contract

Sending transactions to an arbitrary smart contract makes sense when the called method does not depend on the `msg.sender` address. For example, the address is passed in the arguments, or it involves meta-transactions or account abstraction.

For example, a standard transaction within one network:

```solidity
sender.sendTransaction({
    from: sender.address, // sender
    to: smartContract.address, // called smart contract
    value: 0, // amount of funds sent
    data: '0x11111...' // encoded transaction
})
```

To deliver a similar transaction to another network, it looks like this:

```typescript
yarRequest.send({
    initialChainId,
    sender: sender.address, // sender
    payer: sender.address, // sender
    targetChainId,
    target: smartContract.address, // called smart contract
    value: 0, // amount of funds sent
    data: '0x11111...', // encoded transaction
    _nonce: 0
})
```

By executing this transaction, the `YarResponse` smart contract will parse the bytes from `data` and call the specified function at the `target` address. You can also pass the `value` parameter with this transaction if needed.


### Cross-Chain API

The main potential of the Yar protocol lies in enabling communication between smart contracts of the same application located on different networks.

<br>
Create an empty smart contract:

```solidity
contract Example {

}
```

Register the addresses of [YarRequest] and [YarResponse] in the smart contract:

```solidity
contract Example {
    address public yarRequest;
    address public yarResponse;

    constructor(
        address initialYarRequest,
        address initialYarResponse
    ) {
        yarRequest = initialYarRequest;
        yarResponse = initialYarResponse;
    }
}
```

To send a cross-chain transaction from a smart contract, the [YarRequest] will require the data model [YarLib.YarTX].

```solidity
library YarLib {
    struct YarTX {
        uint256 initialChainId; // Identifier of the current network
        address sender; // Your smart contract [Example]
        address payer; // User who calls Example and pays the fee in Yar
        uint256 targetChainId; // Identifier of the network where the transaction will be delivered
        address target; // Address in the [TARGET] network where the transaction will be called
        uint256 value; // Amount of the native token of the [TARGET] network to be sent with the transaction
        bytes data; // Encoded transaction data (bytes4 for the function signature + function arguments)
        uint256 _nonce; // This parameter will be redefined in YarRequest; set it to 0
    }
}
```

Import `YarLib` into your smart contract:

```solidity
import { YarLib } from "./YarLib.sol";

contract Example {
    ...
}
```

Develop a receiver function that will accept a string of data. Two checks are required to identify the senders:

1. Check that `msg.sender` equals the `yarResponse` address.
2. Check that `yarTX.sender` equals the address of your smart contract from the initial network.

```solidity
contract Example {
    string public lastMessage;

    function exampleReceiveMessage(string calldata message) external {
        require(msg.sender == yarResponse, "only yarResponse!");
        YarLib.YarTX memory yarTx = YarResponse(yarResponse).trustedYarTx();
        // Check against address(this)
        // - This will work if both smart contracts have the same address
        // If your smart contracts have different addresses, you will need to register them separately
        require(yarTx.sender == address(this), "only app!");
        lastMessage = message;
    }
}
```

Example of registering the addresses of your applications from external networks:

```solidity
contract Example {

    mapping(uint256 chainId => address peer) public peers;

    function setPeer(uint256 newChainId, address newPeer) external {
        require(msg.sender == owner, "only owner!");
        peers[newChainId] = newPeer;
    }

    function getPeer(uint256 _chainId) public view returns (address) {
        address peer = peers[_chainId];
        return peer == address(0) ? address(this) : peer;
    }

    function exampleReceiveMessage(string calldata message) external {
        require(msg.sender == yarResponse, "only yarResponse!");
        YarLib.YarTX memory yarTx = YarResponse(yarResponse).trustedYarTx();
        require(yarTx.sender == getPeer(yarTx.initialChainId), "only app!");
        ...
    }
}
```

Now, to make this function callable from another network, implement a message-sending function.

```solidity
contract Example {
    function exampleSendMessage(
        string calldata message,
        uint256 targetChainId
    ) external returns(YarLib.YarTX) {
        ...
    }
}
```

Where `message` is the message to be sent  
`targetChainId` is the network where the message will be delivered  
`returns(YarLib.YarTX)` is used in simulation for gas estimation.

Encode the call to the [exampleReceiveMessage] function:

```solidity
bytes memory encodedTX = abi.encodeWithSelector(
    Example.exampleReceiveMessage.selector,
    message
);
```

Then create `YarTX`:

```solidity
YarLib.YarTX memory yarTx = YarLib.YarTX(
    block.chainid,
    address(this), // if your applications have identical addresses
    msg.sender,
    targetChainId,
    targetAddress,
    0,
    encodedTX,
    0
);
```

or

```solidity
YarLib.YarTX memory yarTx = YarLib.YarTX(
    block.chainid,
    getPeer(targetChainId), // to get the address of your application in the target network
    msg.sender,
    targetChainId,
    targetAddress,
    0,
    encodedTX,
    0
);
```

Next, send this model to `YarRequest`:

```solidity
contract Example {
    function exampleSendMessage(
        string calldata message,
        uint256 targetChainId
    ) external returns(YarLib.YarTX) {
        bytes memory encodedTX = abi.encodeWithSelector(
            Example.exampleReceiveMessage.selector,
            message
        );

        YarLib.YarTX memory yarTx = YarLib.YarTX(
            block.chainid,
            address(this), // if your applications have identical addresses
            msg.sender,
            targetChainId,
            targetAddress,
            0,
            encodedTX,
            0
        );

        // Send the transaction
        // Returning the model can be useful for transaction simulation and fee estimation
        return YarRequest(yarRequest).send(yarTX);
    }
}
```

Now, for the user to send a transaction from one of your smart contracts to another in an external network, they must have a balance in YarHub.

The balance can be topped up through `YarRequest`:

```solidity
yarRequest.connect(user).deposit(nativeTokenAmount);
```

Next, grant permission to your application to spend funds:

```solidity
yarRequest.connect(user).approve(yourAppFromInitialChainAddress, yarAmount);
```

Then, call your application:

```solidity
example.connect(user).exampleSendMessage('Hello!', targetChainId);
```

The rest will be handled by the YAR network.

First, the deposit will be credited to YarHub:

```solidity
yarHub.connect(relayers).deposit(user.address, yarTokenAmount);
```

Next, permission will be recorded for the transfer to the application:

```solidity
yarHub.connect(relayers).approve(user.address, initialChainId, yourAppFromInitialChainAddress, yarTokenAmount);
```

Then, the user's transaction will be added to the queue:

```solidity
yarHub.connect(relayers).createTransaction(yarTX, initialNativeTxHash);
```

After that, the transaction will be processed, temporarily locking sufficient funds on the user's deposit to complete the transaction:

```solidity
yarHub.connect(relayers).executeTransaction(yarTX, feeTokensToLock);
``` 

Finally, the YAR network will deliver the transaction to the target network:

```solidity
yarResponse.connect(relayers).deliver(yarTX);
``` 

In the target network, the `YarResponse` smart contract will execute the transaction:

```solidity
yarTx.target.call{ value: yarTx.value }(yarTx.data);
```
