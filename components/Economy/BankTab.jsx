'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

export default function BankTab() {
  const { user, currency, role } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [depositAmount, setDepositAmount] = useState('');
  
  useEffect(() => {
    if (user) {
      fetchAccounts();
      fetchTransactions();
    }
  }, [user]);

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .order('created_at', { ascending: false });
    if (data) setAccounts(data);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setTransactions(data);
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    const amount = parseInt(depositAmount, 10);
    if (!amount || amount <= 0) return alert('올바른 금액을 입력하세요.');
    if (amount > (role?.balance || 0)) return alert('잔액이 부족합니다.');

    if (confirm(`${amount.toLocaleString()}${currency}를 예금하시겠습니까? (이율 5%)`)) {
      // 1. Transaction
      const { error: txError } = await supabase.rpc('process_transaction', {
        p_user_id: user.id,
        p_amount: -amount,
        p_description: '정기 예금 가입',
        p_type: 'DEPOSIT'
      });

      if (txError) return alert('처리 중 오류가 발생했습니다.');

      // 2. Create account
      await supabase.from('bank_accounts').insert([{
        user_id: user.id,
        product_name: '정기 예금',
        principal: amount,
        interest_rate: 0.05
      }]);

      setDepositAmount('');
      fetchAccounts();
      fetchTransactions();
      alert('예금 가입이 완료되었습니다!');
      window.dispatchEvent(new CustomEvent('show-pet'));
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
      <div>
        <div className="glass-panel" style={{ padding: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
          <h2 style={{ color: '#4b5563', fontSize: '1.2rem', marginBottom: '0.5rem' }}>내 지갑 잔액</h2>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
            {(role?.balance || 0).toLocaleString()} <span style={{ fontSize: '1.5rem' }}>{currency}</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>통장 거래 내역 (최근 10건)</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {transactions.map(tx => (
              <li key={tx.id} style={{ padding: '0.8rem 0', borderBottom: '1px solid rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold' }}>{tx.description}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{new Date(tx.created_at).toLocaleDateString()}</div>
                </div>
                <div style={{ fontWeight: 'bold', color: tx.amount > 0 ? '#15803d' : '#b91c1c' }}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} {currency}
                </div>
              </li>
            ))}
            {transactions.length === 0 && <li style={{ textAlign: 'center', color: '#6b7280' }}>거래 내역이 없습니다.</li>}
          </ul>
        </div>
      </div>

      <div>
        <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>예금 상품 가입</h3>
          <p style={{ marginBottom: '1rem', color: '#4b5563', fontSize: '0.9rem' }}>
            현재 <strong>5%</strong>의 이자를 지급하는 정기 예금에 가입할 수 있습니다.<br/>
            (가입 후 임의 해지는 교사에게 문의하세요)
          </p>
          <form onSubmit={handleDeposit} style={{ display: 'flex', gap: '1rem' }}>
            <input 
              type="number" 
              className="glass-input" 
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="예금할 금액" 
              min="1"
              required 
            />
            <button type="submit" className="glass-button" style={{ background: 'var(--primary)', color: 'white', whiteSpace: 'nowrap' }}>
              가입하기
            </button>
          </form>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>내 예금 목록</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {accounts.map(acc => (
              <div key={acc.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold' }}>{acc.product_name}</span>
                  <span style={{ color: '#6b7280', fontSize: '0.9rem' }}>이율: {acc.interest_rate * 100}%</span>
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                  원금: {acc.principal.toLocaleString()} {currency}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  가입일: {new Date(acc.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
            {accounts.length === 0 && <p style={{ textAlign: 'center', color: '#6b7280' }}>가입한 예금 상품이 없습니다.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
