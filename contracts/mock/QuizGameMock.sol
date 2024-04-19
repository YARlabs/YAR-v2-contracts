// // SPDX-License-Identifier: UNLICENSED
// pragma solidity 0.8.20;

// contract QuizGameMock {
//     bytes32 public secretHash;
//     uint256 public rewards;
//     uint256 public fee;

//     address public winner;

//     constructor(bytes32 initialSecretHash, uint256 initialRewards) payable {
//         require(msg.value == initialRewards, "msg.value!");
//         secretHash = initialSecretHash;
//         rewards = initialRewards;
//     }

//     function sendAnswer(address sendRewardsTo, string calldata answer) external payable {
//         require(msg.value == fee, "fee!");
//         require(winner == address(0), "quiz end!");

//         if (keccak256(abi.encodePacked(answer)) == secretHash) {
//             winner = sendRewardsTo;
//             (bool success, ) = sendRewardsTo.call{ value: rewards }("");
//             require(success, "send rewards failed!");
//         }
//     }
// }
