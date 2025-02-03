import React, { useState, useEffect } from 'react';
import { dbank_latest_backend as dbank } from '../../../declarations/dbank-latest-backend';
import './main.css';

const Dbank = () => {
  const [balance, setBalance] = useState(0);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        await dbank.compound();
        const currentBalance = await dbank.checkBalance();
        setBalance(Math.round(currentBalance * 100) / 100);
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    };

    fetchBalance();
  }, []);

  const handleTopUp = async (e) => {
    e.preventDefault();
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      console.error('Invalid top-up amount. Please enter a positive number.');
      return;
    }
    setLoading(true);
    try {
      await dbank.topUp(amount);
      const updatedBalance = await dbank.checkBalance();
      setBalance(Math.round(updatedBalance * 100) / 100);
      setTopUpAmount('');
    } catch (error) {
      console.error('Error topping up:', error);
    } finally {
      await dbank.compound();
      setLoading(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      console.error('Invalid withdrawal amount. Please enter a positive number.');
      return;
    }
    setLoading(true);
    try {
      await dbank.withdraw(amount);
      const updatedBalance = await dbank.checkBalance();
      setBalance(Math.round(updatedBalance * 100) / 100);
      setWithdrawAmount('');
    } catch (error) {
      console.error('Error withdrawing:', error);
    } finally {
      await dbank.compound();
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <img src="dbank_logo.png" alt="DBank logo" width="100" />
      <h1>Current Balance: ${balance.toFixed(2)}</h1>
      <div className="divider"></div>
      <form onSubmit={handleTopUp}>
        <h2>Amount to Top Up</h2>
        <input id="input-amount" type="number" step="0.01" min="0" name="topUp" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)} />
        <button id="submit-btn" type="submit" disabled={loading}>
          Top Up
        </button>
      </form>
      <form onSubmit={handleWithdraw}>
        <h2>Amount to Withdraw</h2>
        <input id="withdrawal-amount" type="number" step="0.01" min="0" name="withdraw" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
        <button id="submit-btn" type="submit" disabled={loading}>
          Withdraw
        </button>
      </form>
    </div>
  );
};

export default Dbank;
