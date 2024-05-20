# Протокол YAR

Протокол YAR реализует сеть доставки ончейн транзакций во внешние сети.
Он состоит из следующих элементов:

0. Стандартная EVM транзакция, которую требуется доставить
1. Смарт-контракт YarRequest, являющийся входной точкой
2. Смарт-контракт YarResponse, отвечающий за ончейн доставку транзакции
3. Смарт-контракт YarHub, расположенный только в YarChain, представляющий собой mempool кроссчейн транзакций
4. Solidity структура YarLib.YarTX, обертка над стандартной EVM транзакцией, с дополнительными метаданными
5. EVM-совеместимый блокчейн YarChain
6. Сеть валидаторов Relayers

# 0. Стандартная EVM транзакция

На отправляемые транзакции не накладывается никаких ограничений:

1. Адрес во внешней сети не должен соответсоввать какому либо интерфейсу, транзакции можно даставлять даже на EOA кошельки
2. Транзакция может переводить натиный токен, то есть использовать параметр [value]
3. Транзакция может представлять собой еще один кроссчейн вызов, позволяя составлять сложные последовательности передачи данных из множества сетей

# 1. Смарт-контракт YarRequest

Отправная точка протокола.
Отвечает за передачу событий валидаторам.

Есть 3 вида уникальных событий:

1. Send - отправка кроссчейн транзакции

```solidity
event Send(
    YarLib.YarTX yarTx
);
```

2. Deposit - пополнение баланса, списываемого в счет оплаты кроссчейн транзакций

```solidity
event Deposit(
    address depositor,
    address feesToken,
    uint256 amount
);
```

3. Approve - подобно EIP20.approve. Разрешает приложениям списывать баланс пользователя, для оплаты его кроссчейн транзакции

```solidity
event Approve(
    address account,
    uint256 initialChainId,
    address spender,
    uint256 amount
);
```

Каждому событию соответсвует одноименная функция

1. send - принимает YarLib.YarTX, и отправляет его сети Relayers

```solidity
function send(YarLib.YarTX memory yarTX) external returns (YarLib.YarTX memory);
```

2. deposit - принимает от пользователя токен (нативный или eip20)

```solidity
function deposit(uint256 amount) public payable;
```

3. approve - разрешает [spender] списывать с депозита пользователя [amount] YarToken

```solidity
function approve(address spender, uint256 amount) public;
```

# 2. Смарт-контракт YarResponse

Является входной точкой для отправки транзакций сетью валидаторов Relayers. Происходит это посредством функции [deliver], которая развертывает кроссчейн транзакцию [yarTx] и доставляет ее адресату

```solidity
function deliver(YarLib.YarTX calldata yarTx) external payable {
    ...
    yarTx.target.call{ value: yarTx.value }(yarTx.data);
    ...
}
```

Так же, этот смарт контракт исползуется приложениями для авторизации вызова, если их функция приемник должна примать вызовы только от Relayers, а не любого адреса.

Временно, хранит метаданные текущей кроссчейн транзакции, которые доступны для чтения в функции [trustedYarTx]. Метаданные записываются до вызова и удаляются сразу после.

```solidity
function trustedYarTx() external view returns (YarLib.YarTX memory);
```

# 3. Смарт-контракт YarHub

YarHub хранит все ожидающие, исполненыне и провалившиеся кроссчейн транзакции, которые доступны в сопоставленнии [wrappedYarTXs]

```solidity
function wrappedYarTXs(bytes32 yarTxHash) extenral view returns(WrappedYarTX);
```

Для доступа к определенной транзакции [yarTx], в качетсве ключа используется keccak hash всей модели YarLib.YarTx

```solidity
keccak256(abi.encode(yarTX))
```

Так же получить идентифицирующий хэш кроссчейн транзакции можно с помощью метода [YarHub.getYarTxHash]

```solidity
function getYarTxHash(YarLib.YarTX calldata yarTX) public pure returns (bytes32);
```
