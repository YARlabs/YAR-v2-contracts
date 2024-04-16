# YarLib

Вспомогательная библиотека, хранящая общий код.
используется в YarRequest, YarResponse, YarHub. Может использоваться сторонними приложениями

```solidity
library YarLib {
    // Модель со всеми данными кросс-чейн транзакции
    struct YarTX {
        uint256 initialChainId; // сеть отправки
        address sender; // кто платит комиссию в YarHub
        address app; // Кто отправил запрос в YarRequest
        uint256 targetChainId; // сеть доставки
        address target; // Адрес по которому будет передано [value] и выполнена [data]
        uint256 value; // Сколько нативных токенов отправить на адрес [target]
        bytes data; // 0x или закодированный вызов функции
        uint256 depositToYarAmount; // Сколько комиссий было отправленно вместе с транзакцией, может быть 0, если у пользователя уже был депозит
    }
}
```

# YarRequest

Развернут в каждой сети, в том числе и в YarChain

```solidity
interface YarRequest {
    // Событие на основании которого ожидающая транзакция добавляется в YarHub
    event Send(
        YarLib.YarTX yarTx // Модель кросс-чейн транзакции
    );

    // Событие на основании которого зачисляется баланс для опалаты коммисий на счет [depositor] в YarHub
    event Deposit(
        address depositor, // Кому зачислить
        address feesToken, // Токен оплаты в initial сети
        uint256 amount // количество feesToken принятых в качестве оплаты
    );

    // Адрес мультисиг кошелька, на который будут переводиться средства в счет оплаты депозита
    function relayer() external view returns(address);

    // Токен принимаемый в качестве оплаты комиссий
    // Если feeToken == address(0), то это нативный токен текущей сети
    function feeToken() external view returns(address);

    // Проверяет разрешил ли [sender], отправить транзакцию [yarTxHash] с адреса [app]
    function approvals(
        address sender, // Кто оплатит комиссию
        address app, // Кто инициурет транзакцию
        bytes32 yarTxHash // Хэш получаемый из YarLib.YarTX
    ) external view returns(bool);

    // Используется для пополнения депозита в YarHub
    // Оплата производиться в текущем feeToken
    function deposit(
        address account, // На чей счет зачислить
        uint256 amount // Сколько feeToken было принято в initial сети
    ) external payable;

    // Эта функция позволяет за одну транзакцию
    // Выдать approve и вызвать приложение которое
    // Сможет от имени пользователя совершить кросс-чейн транзакцию 
    function approveAndCallApp(
        bytes calldata appData, // Закодированный вызов функции, который будет выполнен по адресу yarTX.app
        YarLib.YarTX calldata yarTX // Кросс-чейн транзакция на которую будет выдано разрешение, от yarTX.sender к yarTX.app
    ) external payable;

    // Разрешает приложению [yarTX.app] отправить транзакцию [yarTX], которую оплатит [yarTX.sender] 
    function approve(YarLib.YarTX calldata yarTX) external;

    // Отправить кроссчейн транзакцию с адреса [yarTx.app], которую оплатит [yarTx.sender]
    function sendFrom(YarLib.YarTX calldata yarTX) external payable;

    // Вызывает _approve, если
    // signature соответствует подписи [yarTX.sender]
    function permit(
        YarLib.YarTX calldata yarTX,
        uint256 signatureExpired,
        bytes calldata signature
    ) external;

    // Отправляет кросс-чейн транзакцию
    // Где msg.sender == yarTX.sender == yarTx.app
    function send(YarLib.YarTX calldata yarTX) external payable;
}
```

# YarResponse

Развернут в каждой сети, в том числе и в YarChain

```solidity
interface YarResponse {
    // Адрес мультисиг кошелька, на который будут переводиться средства в счет оплаты депозита
    function relayer() external view returns(address);

    // Геттер в котором временно сохраняется текущая исполняемая транзакция
    // Он устанавливается до вызова target, и очищается после
    function trustedYarTx() external view returns(YarLib.YarTX);

    // Вызывается только с адреса [relayer]
    // Доставка транзакции в target сети
    function deliver(YarLib.YarTX calldata yarTx) external payable;
}
```

# YarHub

Развернут только в сети YAR.

```solidity
interface YarHub {
    // Вспомогательный тип данных для обозначения статуса транзакции
    enum TxStatus {
        NotExists, // Транзакция не существует
        WaitForPay, // Ожидает пополнения депозита
        InProgress, // Депозит заблокирован, и транзакция передана на выполение в YarResponse
        Completed, // Транзакция выполнена успешно, депозит разблокирован
        Rejected // Транзакция завершилась ошибкой, депозит разблокирован
    }

    // Обернутая YarLib.YarTX, с дополнительными полями используемыми только в YarHub
    struct WrappedYarTX {
        YarLib.YarTX yarTx; // Модель транзакции
        TxStatus status; // Текущий статус
        uint256 lockedFees; // Сколько было заблокировано с депозита отправителя. Устанавливается после execute
        uint256 usedFees; // Сколько комиссий было израсходовано. Устанавливается после commit
        bytes32 initialTxHash; // Хэш транзакции инициировавшей перевод в initial сети
        bytes32 targetTxHash; // Хэш транзакции в target сети
    }

    // Одноименный ивент функции
    event CreateTransaction(YarLib.YarTX yarTx);

    // Одноименный ивент функции
    event ExecuteTransaction(YarLib.YarTX yarTx);

    // Срабатывает когда транзакция была отправлена в target сеть и завершилась
    // или успешно, тогда status = TxStatus.Completed
    // или c оишбкой, тогда status = TxStatus.Rejected
    event CommitTransaction(YarLib.YarTX yarTx, TxStatus status, uint256 usedFees, uint256 feesToReturn);

    // Одноименный ивент функции
    event Deposit(
        address account, // На чей счет зачислен
        uint256 amount // Сколько токенов комиссии зачислено
    );

    // Вызывается с адреса relayer
    // Если было событие пополнения депозита из initial сети,
    // Тогда эта функция должна быть вызвана до executeTransaction
    // Иначе вторая завершится ошибкой "feeTokensToLock!"
    // Зачисляет [feeTokenAmount] токенов на баланс [account]
    function deposit(address account, uint256 feeTokenAmount) external;

    // Вызывается с адреса relayer
    // Добавляет новую траназкцию в память
    // Статус новой транзакции - WaitForPay
    // lockedFees - 0
    // usedFees - 0
    // initialTxHash = initialTxHash - хэш транзакции в initial сети
    function createTransaction(YarLib.YarTX calldata yarTX, bytes32 initialTxHash) external;

    // Вызывается с адреса relayer
    // Если транзакция до этого не была создана будет ошибка "only WaitForPay!"
    // Параметр feeTokensToLock - это расчетное число, с запасом, которое будет временно списано с баланса пользователя
    // если в deposits[yarTX.sender] средств меньше чем feeTokensToLock, транзакция завершится ошибкой "feeTokensToLock!"
    // Если удалось списать депозит, излучает ивент ExecuteTransaction,
    // На основании которого транзакция должна быть доставлена в target сеть
    function executeTransaction(YarLib.YarTX calldata yarTX, uint256 feeTokensToLock) external;

    // Вызывается с адреса relayer
    // После совершения успешной транзакции в target сети, устанавливаем статус в TxStatus.Completed
    // Требуется указать usedFees - то сколько в итоге можем списать со счета юзера
    // Если usedFees превышает заблокированные средства, то ничего не возвращаем
    // Иначе зачисляет разницу на баланс пользователя
    function completeTransaction(YarLib.YarTX calldata yarTX, bytes32 targetTxHash, uint256 usedFees) external;

    // Вызывается с адреса relayer
    // После ошибки транзакции в target сети, устанавливаем статус в TxStatus.Rejected
    // Требуется указать usedFees - то сколько в итоге можем списать со счета юзера
    // Если usedFees превышает заблокированные средства, то ничего не возвращаем
    // Иначе зачисляет разницу на баланс пользователя
    function rejectTransaction(YarLib.YarTX calldata yarTX, bytes32 targetTxHash, uint256 usedFees) external
}
```

Базовый алгоритм:

YarRequest -> emit Deposit(address depositor, address feesToken, uint256 amount)
-> emit Send(YarLib.YarTX yarTx)

Relayer's в первую очередь должны обработать депозиты, выполнив перерасчет feesToken и amount, к feeTokenAmount сети Yar
После чего отправить транзакции:
YarHub.connect(relayer).deposit(depositor, feeTokenAmount)

После чего Relayer's приступает к обработке событий Send:
Сначала отправляя транзакции, которые создадут ожидающие транзакции
YarHub.connect(relayer).createTransaction(yarTx)

Затем повторно расчитывается требуемо число комиссий, но уже для токенов Yar, и передается в качестве feeTokensToLock
YarHub.connect(relayer).executeTransaction(yarTx, feeTokensToLock)

Если средств у пользователя было достаточно, сработает событие
-> emit ExecuteTransaction(YarLib.YarTX yarTx)
На основании которого транзакцию можно доставлять в target сеть
Но если средств не достаточно, то транзакция завершится ошибкой "feeTokensToLock!"

После события ExecuteTransaction и ее выполнения, расчитывается итоговый расход комиссий и передается далее как "usedFees"
В зависимости как транзакция исполнилась,
сеть Relayer's отправляет или
YarHub.connect(relayer).completeTransaction(yarTx, usedFees)
или
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
