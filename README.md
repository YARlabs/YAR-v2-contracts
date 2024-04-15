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
