# Документация

## Протокол

Протокол YAR реализует сеть доставки ончейн транзакций во внешние сети.
<br>
Он состоит из следующих элементов:

0. Стандартная EVM транзакция, которую требуется доставить
1. Смарт-контракт YarRequest, являющийся входной точкой
2. Смарт-контракт YarResponse, отвечающий за ончейн доставку транзакции
3. Смарт-контракт YarHub, расположенный только в YarChain, представляющий собой mempool кроссчейн транзакций
4. Solidity структура YarLib.YarTX, обертка над стандартной EVM транзакцией, с дополнительными метаданными
5. EVM-совеместимый блокчейн YarChain
6. Сеть валидаторов Relayers

Которые объединяется в следующую последовательность:

1. Инициатор(EOA кошелек или смарт контракт) вызывают YarRequest.send(...)
2. YarRequest генерирует событе Send
3. Relayers получив событие Send добавляет ожидающую транакцию в YarHub
4. После добавления транзакции в очередь, Relayers переводят транзакции в исполнение, блокируя достаточную сумму комиссий
5. Relayers вызывают YarResponse.deliver(...), которая исполнит транзакцию по адресу назначения
6. После исполнения транзакции, Relayers обновляет стататус транзакции, и возвращает неизрасходованные комисии

### 0. Стандартная EVM транзакция

На отправляемые транзакции не накладывается никаких ограничений:

1. Адрес во внешней сети не должен соответсоввать какому либо интерфейсу, транзакции можно даставлять даже на EOA кошельки
2. Транзакция может переводить натиный токен, то есть использовать параметр [value]
3. Транзакция может представлять собой еще один кроссчейн вызов, позволяя составлять сложные последовательности передачи данных из множества сетей

### 1. Смарт-контракт YarRequest

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

### 2. Смарт-контракт YarResponse

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

!!! Передача флагов включающий/выключабщих запись полей trustedYarTx в storage может сэкономить газ

### 3. Смарт-контракт YarHub

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

Так же YarHub хранит депозиты пользователей в токенах Yar, используемуе для оплаты комиссий.
<br>
Баланс зачисляется на депозит только с адреса relayer, после обработки события Deposit
<br>
Посмотреть текущий баланс

```solidity
uint256 balance = yarHub.deposits(account);
```

### 4. Solidity структура YarLib.YarTX

```solidity
library YarLib {
    struct YarTX {
        uint256 initialChainId; // идентификатор текущей сети
        address sender; // Ваш смарт контракт [Example]
        address payer; // Пользователь, который вызывает Example, и платит комиссию в Yar
        uint256 targetChainId; // идентификатор сети, в которую будет доставлена транзакция
        address target; // Адрес в сети [TARGET], по которому будет вызвана транзакция
        uint256 value; // Сумма нативного токена [TARGET] сети, которые будут переданны с транзакцией
        bytes data; // Закодированные данные транзакции (bytes4 для сигнатуры функции + аргументы функции)
        uint256 _nonce; // Этот параметр будет перепорпеделен в YarRequest, устанавливайте его в 0
    }
}
```

!!! YarTX._nonce требует рефакторинга

## Комиссии

Для оплаты газа в сети доставки, протокол взымает с баланса пользователя достаточную сумму в токенах Yar, которая хранится в сети Yar, на смарт-контракте YarHub
<br>
Что бы сеть Relayers исполнила транзакцию, пользователь предварительно вносит достаточную сумму на депозит.
<br>
Если на момент исполенения транзакции у пользователя не будет достаточного депозита, транзакция останется в очереди.
<br>
Делается это посреством вызова функции deposit в смарт-контракте YarRequest, из любой поддерживаемой сети

```solidity
yarRequest.deposit(amount);
```

В каждой сети используется свой токен оплаты, обычно это нативный токен сети, но может быть и eip20 токен.
<br>
Посмотреть какой токен используется можно

```solidity
address feeToken = yarRequest.feeToken();
```

Если feeToken == address(0), тогда используется нативный токен сети, иначе указанный eip20
<br>

Например вызвав функцию YarRequest.deposit(1e18) в сети Ethereum, с коешлька пользователя будет списан 1ETH, который затем по текущему курсу конвертируется в токены YAR, которые будут зачислены на депозит пользоваетеля в YarHub

<br>

Что бы осуществлять вызов кроссчейн транзакций с адреса произвольного смарт контракта, но оплачивать комиссию yar с адреса пользователя, требуется что бы пользователь разрешил приложению списывать депозит от его имени.

```solidity
yarRequest.approve(appAddress, yarAmount)
```

## Сценарии использования

Протокол YAR позволяет отправлять произвольные транзакции на любой адрес, будь то адрес смарт-контракта или же EOA кошелек

### Отправка транзакций на EOA кошелек

Обычно они имеют смысл только в переводе нативного токена сети, сумма которого указана в параметре value.

На примере обычной транзакции в рамках одной сети

```typescript
sender.sendTransaction({
  from: sender.address, // отправитель
  to: recipeint.address, // получатель
  value: 1e18, // сумма отправленных средств
})
```

Тогда для доставки подобной транзакции в другую сеть, это выглядит так

```typescript
yarRequest.send({
  initialChainId,
  sender: sender.address, // отправитель
  payer: sender.address, // отправитель
  targetChainId,
  target: recipient.address, // получатель
  value: 1e18, // сумма отправленных средств
  data: '0x',
  _nonce: 0,
})
```

После исполнения этой транзакции сеть Relayers переведет 1e18 нативный токенов сети target на адрес recipient

### Отправка транзакций на смарт-контракт

Отправка транзакций на произвольный смарт-контракт имеет смысл тогда, когда вызываемый метод не зависит от адреса msg.sender.
Например адрес передается в аргументах, или это мета-транзакции, или account abstraction.

На примере обычной транзакции в рамках одной сети

```typescript
sender.sendTransaction({
    from: sender.address, // отправитель
    to: smartContract.address, // вызываемый смарт-контракт
    value: 0 // сумма отправленных средств,
    data: '0x11111...' // закодированная транзакция
})
```

Тогда для доставки подобной транзакции в другую сеть, это выглядит так

```typescript
yarRequest.send({
    initialChainId,
    sender: sender.address, // отправитель
    payer: sender.address, // отправитель
    targetChainId,
    target: smartContract.address, // вызываемый смарт-контракт
    value: 0, // сумма отправленных средств
    data: '0x11111...' // закодированная транзакция
    _nonce: 0
})
```

Исполняя эту транзакцию, смарт контракт YarResponse распарсит байты из data и вызовет указанную в них функцию по адресу target. С этой транзакцией так же можно передать параметр value, если требуется

### Кроссчейн API

Основной потенциал протокола Yar состоит в том, что позволяет реализовать сообщение между смарт контрактами одного приложения расположенных в разных сетях.

<br>
Создайте пустой смарт контракт

```solidity
contract Example {

}
```

Зарегестрируйте в смарт-контракте адреса [YarRequest] и [YarResponse]:

```solidity
contract Example {
    address public yarRequest;
    address public yarResponse;

    constructor(
        address intialYarRequest,
        address intialYarResponse
    ) {
        yarRequest = intialYarRequest;
        yarResponse = intialYarResponse;
    }
}
```

Для того что бы отправить кроссчейн транзакцию со смарт-контракта, в [YarRequest] потребуется отправить модель данных [YarLib.YarTX]

```solidity
library YarLib {
    struct YarTX {
        uint256 initialChainId; // идентификатор текущей сети
        address sender; // Ваш смарт контракт [Example]
        address payer; // Пользователь, который вызывает Example, и платит комиссию в Yar
        uint256 targetChainId; // идентификатор сети, в которую будет доставлена транзакция
        address target; // Адрес в сети [TARGET], по которому будет вызвана транзакция
        uint256 value; // Сумма нативного токена [TARGET] сети, которые будут переданны с транзакцией
        bytes data; // Закодированные данные транзакции (bytes4 для сигнатуры функции + аргументы функции)
        uint256 _nonce; // Этот параметр будет перепорпеделен в YarRequest, устанавливайте его в 0
    }
}
```

Импортируйте YarLib в свой смарт контракт

```solidity
import { YarLib } from "./YarLib.sol";

contract Example {
    ...
}
```

Разработаем функцию приемник, которая будет принимать строку данных.
Здесь потребуется выполнить 2 проверки, что бы идентицифицровать отправителей:

1. Проверьте что msg.sender равен адресу YarResponse
2. Проверьте что yarTX.sender равен адресу вашего смарт контракта из initial сети

```solidity
contract Example {
    string public lastMessage;

    function exampleReceiveMessage(string calldata message) external {
        require(msg.sender == yarResponse, "only yarResponse!");
        YarLib.YarTX memory yarTx = YarResponse(yarResponse).trustedYarTx();
        // Используется проверка на address(this)
        // - это сработает если оба смарт-окнтра имеют один и тот же адрес
        // Если у ваших смарт контрактов разные адреса, то придется их регестрировать отдельно
        require(yarTx.sender == address(this), "only app!");
        lastMessage = message;
    }
}
```

Пример регистрации адресов своих приложений из внешних сетей

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

Теперь что бы эту функцию можно было вызвать из другой сети, реализуем функцию отправки сообщения.

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

Где message - отправляемое сообщение
<br>
targetChainId - сеть в которую будет доставлено сообщение
<br>
returns(YarLib.YarTX) - Используется в эмуляции, для расчета расходов на газ
<br>

Закодируйте вызов функции [exampleReceiveMessage]

```solidity
bytes memory encodedTX = abi.encodeWithSelector(
    Example.exampleReceiveMessage.selector,
    message
)
```

Затем создайте YarTX

```solidity
YarLib.YarTX memory yarTx = YarLib.YarTX(
    block.chainid,
    address(this), // если адреса ваших приложений идентичные
    msg.sender,
    targetChainId,
    targetAddress,
    0,
    encodedTX,
    0
);
```

или

```solidity
YarLib.YarTX memory yarTx = YarLib.YarTX(
    block.chainid,
    getPeer(targetChainId), // для получения адреса вашего приложения в target сети
    msg.sender,
    targetChainId,
    targetAddress,
    0,
    encodedTX,
    0
);
```

И отправьте эту модель в YarRequest

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
            address(this), // если адреса ваших приложений идентичные
            msg.sender,
            targetChainId,
            targetAddress,
            0,
            encodedTX,
            0
        );

        // Отправляем транзакцию
        // Возврат модели может быть полезен для симуляции транзакций и предварительного расчета комиссиий
        return YarRequest(yarRequest).send(yarTX);
    }
}
```

Теперь что бы пользователь смог отправить из одного вашего смарт контракта транзакцию в другой ваш смарт контракт во внешней сети, у него дожен быть баланс в YarHub.

Пополнить его можно через YarRequest

```typescript
yarRequest.connect(user).deposit(nativeTokenAmount)
```

И выдать разрешение на списание средств вашему приложению 

```typescript
yarRequest.connect(user).approve(yourAppFromInitialChainAddress,yarAmount)
```

И после чего вызвать ваше приложение


```typescript
example.connect(user).exampleSendMessage('Hello!', targetChainId)
```

Затем всю остальную работы выпонит сеть YAR

Сначала пополнит депозит в YarHub

```typescript
yarHub.connect(relayers).deposit(user.address, yarTokenAmount)
```

Затем запишет разрешение на перевод приложению

```typescript
yarHub.connect(relayers).approve(user.address, initialChainId, yourAppFromInitialChainAddress, yarTokenAmount)
```

Добавит транзакцию пользователя в очередь 

```typescript
yarHub.connect(relayers).createTransaction(yarTX, initialNativeTxHash)
```

Возьмет в работу, временно заблокировав достаточную сумму средств на депозите пользователя

```typescript
yarHub.connect(relayers).executeTransaction(yarTX, feeTokensToLock)
``` 

И доставит ее в сеть назначения 

```typescript
yarResponse.connect(relayers).deliver(yarTX)
``` 

Где смарт контракт YarResponse выполняет транзакцию 

```solidity
yarTx.target.call{ value: yarTx.value }(yarTx.data);
```