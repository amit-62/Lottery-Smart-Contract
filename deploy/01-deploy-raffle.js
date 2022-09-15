const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-confirg")
const { verify } = require("../utils/veify")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("2")

module.exports = async function({getNamedAccounts, deployments}) {
    const {deploy, log} = deployments
    const {deployer} = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorAddress, subscriptionId, vrfCoordinatorMock

    if(developmentChains.includes(network.name)){
        vrfCoordinatorMock =  await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorAddress = vrfCoordinatorMock.address
        const transactionResponse = await vrfCoordinatorMock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = transactionReceipt.events[0].args.subId
        await vrfCoordinatorMock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)

    }
    else{
        vrfCoordinatorAddress = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]

    const args = [vrfCoordinatorAddress, entranceFee, gasLane, subscriptionId, callbackGasLimit, interval]
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if(!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY){
        console.log("verifying...")
        await verify(raffle.address, args)
    }

    console.log("------------------------A")
}

module.exports.tags = ["all", "raffle"]