import React, { useState, useEffect } from 'react';
import { dbank_latest_backend as dbank } from '../../../declarations/dbank-latest-backend';
import './Dbank.scss';
import { FiArrowUpCircle, FiArrowDownCircle, FiDollarSign } from 'react-icons/fi';

const Dbank = () => {
  const [balance, setBalance] = useState(() => {
    const cached = localStorage.getItem('dbank_balance');
    return cached ? parseFloat(cached) : 0;
  });
  const [topUpAmount, setTopUpAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        await dbank.compound();
        const currentBalance = await dbank.checkBalance();
        const newBalance = Math.round(currentBalance * 100) / 100;
        setBalance(newBalance);
        setLastUpdate(new Date());
        localStorage.setItem('dbank_balance', newBalance.toString());
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
      setNotification({
        show: true,
        message: 'Please enter a valid amount',
        type: 'error'
      });
      setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
      return;
    }
    setLoading(true);
    try {
      await dbank.topUp(amount);
      setNotification({
        show: true,
        message: 'Successfully deposited funds',
        type: 'success'
      });
      setTopUpAmount('');
      const currentBalance = await dbank.checkBalance();
      setBalance(Math.round(currentBalance * 100) / 100);
    } catch (error) {
      setNotification({
        show: true,
        message: 'Error depositing funds',
        type: 'error'
      });
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
      setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setNotification({
        show: true,
        message: 'Please enter a valid amount',
        type: 'error'
      });
      setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
      return;
    }
    setLoading(true);
    try {
      await dbank.withdraw(amount);
      setNotification({
        show: true,
        message: 'Successfully withdrawn funds', 
        type: 'success'
      });
      setWithdrawAmount('');
      const currentBalance = await dbank.checkBalance();
      setBalance(Math.round(currentBalance * 100) / 100);
    } catch (error) {
      setNotification({
        show: true,
        message: 'Error withdrawing funds',
        type: 'error'
      });
    } finally {
      setLoading(false);
      setLastUpdate(new Date());
      setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
    }
  };

  return (
    <div className="dashboard">
      <div className="balance-card">
        <div className="balance-header">
          <FiDollarSign className="icon" />
          <h2>Total Balance</h2>
        </div>
        <div className="balance-amount">
          ${balance.toFixed(2)}
        </div>
        <div className="balance-subtitle">
          Updated {lastUpdate.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Bangkok',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          })} GMT+7
        </div>
      </div>

      <div className="transactions-grid">
        <div className="transaction-card deposit">
          <h3>
            <FiArrowUpCircle className="icon" />
            Top Up
          </h3>
          <form onSubmit={handleTopUp}>
            <div className="input-group">
              <div className="input-prefix">$</div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Deposit Funds'}
            </button>
          </form>
        </div>

        <div className="transaction-card withdraw">
          <h3>
            <FiArrowDownCircle className="icon" />
            Withdraw
          </h3>
          <form onSubmit={handleWithdraw}>
            <div className="input-group">
              <div className="input-prefix">$</div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <button type="submit" disabled={loading}>
              {loading ? 'Processing...' : 'Withdraw Funds'}
            </button>
          </form>
        </div>
      </div>

      {notification.show && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
};

export default Dbank;
