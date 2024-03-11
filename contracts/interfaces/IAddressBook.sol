// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

interface IAddressBook {
    function requireOnlyOwner(address _account) external view;
    function requireTransferValidator(address _account) external view;
    function requireTrasferApprover(bytes32 _messageHash, bytes calldata _signature) external view;
    function treasury() external view returns(address);
    function feeToken() external view returns(address);
}
