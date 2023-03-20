const { getNamedAccounts, ethers } = require("hardhat")
const { getWeth, AMOUNT } = require("./getWETH")

async function main() {
    await getWeth()
    const { deployer } = await getNamedAccounts()
    const pool = await getPool(deployer)
    console.log(`Pool address is: ${pool.address}`)
    // Lending Pool Address Provider: 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e

    // deposit / supply
    // first we have to approve the Aave contract to access our funds
    const wethTokenAddress = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    await approveErc20(wethTokenAddress, pool.address, AMOUNT, deployer)
    console.log("Depositing...")
    await pool.supply(wethTokenAddress, AMOUNT, deployer, 0)
    console.log("Deposited")
    let { totalDebtBase, availableBorrowsBase } = await getBorrowUserData(pool, deployer)

    const daiPrice = await getDaiPrice()
    const amountDaiToBorrow = Number((availableBorrowsBase * 0.95 * (1 / daiPrice)).toFixed(18)) // I think the 0.95 are a safety thing bc if we would borrow 100% then we would be able to get liquidated...
    console.log(`you can borrow ${amountDaiToBorrow} DAI`) // As we can see in patricks code there would be a problem if his number would have more than 18 decimals when used in this calculation. How do I make sure that stuff like this gets tested in real world projects?
    const amountDaiToBorrowWei = ethers.utils.parseEther(amountDaiToBorrow.toString())
    console.log(`in Wei that is ${amountDaiToBorrowWei}`)
    const daiTokenAddress = "0x413AdaC9E2Ef8683ADf5DDAEce8f19613d60D1bb"
    await borrowDai(daiTokenAddress, pool, amountDaiToBorrowWei, deployer)
    await getBorrowUserData(pool, deployer)
}

async function borrowDai(tokenAddress, pool, amountDaiToBorrowWei, account) {
    const borrowTx = await pool.borrow(tokenAddress, amountDaiToBorrowWei, 1, 0, account)
    await borrowTx.wait(1)
    console.log(`You've borrowed ${ethers.utils.formatEther(amountDaiToBorrowWei.toString())}`)
}

async function getDaiPrice() {
    const daiEthPriceFeed = await ethers.getContractAt(
        "AggregatorV3Interface",
        "0x773616E4d11A78F511299002da57A0a94577F1f4"
    )
    const price = (await daiEthPriceFeed.latestRoundData()).answer // instead of ".answer" i could write "[1]". this means that the first index of the return variables is the one selected
    console.log(`The DAI/ETH price is ${ethers.utils.formatEther(price)}`)
    return price
}

async function getBorrowUserData(pool, account) {
    const { totalCollateralBase, totalDebtBase, availableBorrowsBase } =
        await pool.getUserAccountData(account)
    console.log(` ${ethers.utils.formatEther(totalCollateralBase)} ETH deposited`)
    console.log(` ${ethers.utils.formatEther(totalDebtBase)} ETH borrowed`)
    console.log(` ${ethers.utils.formatEther(availableBorrowsBase)} ETH available to borrow`)
    return { totalDebtBase, availableBorrowsBase }
}

async function getPool(account) {
    const PoolAddressesProvider = await ethers.getContractAt(
        "IPoolAddressesProvider",
        "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
        account
    )
    const poolAddress = await PoolAddressesProvider.getPool() //so this refers to the getPool function of the IPoolAddressesProvider.sol
    const pool = await ethers.getContractAt("IPool", poolAddress, account)
    return pool
}

async function approveErc20(erc20Address, spenderAddress, amountToSpend, account) {
    // console.log(` amount to spend for the approval is ${ethers.utils.formatEther(amountToSpend)} ETH`)
    const erc20Token = await ethers.getContractAt("IERC20", erc20Address, account)
    const tx = await erc20Token.approve(spenderAddress, amountToSpend)
    await tx.wait(1)
    console.log(`Approved spender address: ${spenderAddress}`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
