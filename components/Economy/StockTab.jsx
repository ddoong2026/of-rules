'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

export default function StockTab() {
  const { user, currency, role } = useAuth();
  const [stocks, setStocks] = useState([]);
  const [myStocks, setMyStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    const { data: stockData } = await supabase.from('stocks').select('*').order('name');
    if (stockData) setStocks(stockData);

    const { data: myData } = await supabase
      .from('user_stocks')
      .select('*, stocks(*)')
      .eq('user_id', user.id);
    if (myData) setMyStocks(myData);
    
    setLoading(false);
  };

  const handleTrade = async (stock, type, actionName) => {
    const qtyStr = prompt(`'${stock.name}' 주식을 몇 주 ${actionName}하시겠습니까? (현재가: ${stock.current_price.toLocaleString()}${currency})`);
    const quantity = parseInt(qtyStr, 10);
    
    if (!quantity || quantity <= 0) return;
    
    const totalPrice = stock.current_price * quantity;

    if (type === 'BUY') {
      if ((role?.balance || 0) < totalPrice) {
        return alert('잔액이 부족합니다.');
      }
      
      const { error: txError } = await supabase.rpc('process_transaction', {
        p_user_id: user.id,
        p_amount: -totalPrice,
        p_description: `주식 매수: ${stock.name} ${quantity}주`,
        p_type: 'STOCK_BUY'
      });
      if (txError) return alert('오류가 발생했습니다.');

      // Update portfolio
      const existing = myStocks.find(s => s.stock_id === stock.id);
      if (existing) {
        const newTotalQty = existing.quantity + quantity;
        const newAvgPrice = ((existing.quantity * existing.average_price) + totalPrice) / newTotalQty;
        await supabase.from('user_stocks').update({ quantity: newTotalQty, average_price: newAvgPrice }).eq('id', existing.id);
      } else {
        await supabase.from('user_stocks').insert([{ user_id: user.id, stock_id: stock.id, quantity, average_price: stock.current_price }]);
      }
      
      alert('매수가 완료되었습니다!');

    } else if (type === 'SELL') {
      const existing = myStocks.find(s => s.stock_id === stock.id);
      if (!existing || existing.quantity < quantity) {
        return alert('보유 주식 수가 부족합니다.');
      }

      const { error: txError } = await supabase.rpc('process_transaction', {
        p_user_id: user.id,
        p_amount: totalPrice,
        p_description: `주식 매도: ${stock.name} ${quantity}주`,
        p_type: 'STOCK_SELL'
      });
      if (txError) return alert('오류가 발생했습니다.');

      const newQty = existing.quantity - quantity;
      if (newQty === 0) {
        await supabase.from('user_stocks').delete().eq('id', existing.id);
      } else {
        await supabase.from('user_stocks').update({ quantity: newQty }).eq('id', existing.id);
      }
      
      alert('매도가 완료되었습니다!');
    }
    
    fetchData();
    window.dispatchEvent(new CustomEvent('show-pet'));
  };

  if (loading) return <div>로딩중...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
      <div>
        <h2 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>📈 주식 시장</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {stocks.map(stock => (
            <div key={stock.id} className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{stock.name}</h3>
              <p style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.5rem', marginBottom: '1rem' }}>
                {stock.current_price.toLocaleString()} {currency}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button 
                  className="glass-button" 
                  style={{ background: '#ef4444', color: 'white', flex: 1 }}
                  onClick={() => handleTrade(stock, 'BUY', '매수')}
                >
                  매수
                </button>
                <button 
                  className="glass-button" 
                  style={{ background: '#3b82f6', color: 'white', flex: 1 }}
                  onClick={() => handleTrade(stock, 'SELL', '매도')}
                >
                  매도
                </button>
              </div>
            </div>
          ))}
          {stocks.length === 0 && (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#6b7280' }}>현재 상장된 주식이 없습니다.</p>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>💼 내 주식 (포트폴리오)</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {myStocks.map(myStock => {
            const currentTotal = myStock.stocks.current_price * myStock.quantity;
            const investTotal = myStock.average_price * myStock.quantity;
            const profit = currentTotal - investTotal;
            const profitRate = (profit / investTotal) * 100;
            const isProfit = profit >= 0;

            return (
              <div key={myStock.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.5)', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 'bold' }}>{myStock.stocks.name}</span>
                  <span style={{ color: '#4b5563', fontWeight: 'bold' }}>{myStock.quantity}주</span>
                </div>
                <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.2rem' }}>
                  평단가: {Math.round(myStock.average_price).toLocaleString()} {currency}
                </div>
                <div style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                  현재가: {myStock.stocks.current_price.toLocaleString()} {currency}
                </div>
                <div style={{ 
                  fontWeight: 'bold', 
                  color: isProfit ? '#ef4444' : '#3b82f6', // Red for profit, Blue for loss (Korean stock style)
                  background: isProfit ? '#fee2e2' : '#dbeafe',
                  padding: '0.5rem',
                  borderRadius: '4px',
                  textAlign: 'center'
                }}>
                  수익금: {isProfit ? '+' : ''}{profit.toLocaleString()} {currency} ({isProfit ? '+' : ''}{profitRate.toFixed(1)}%)
                </div>
              </div>
            );
          })}
          {myStocks.length === 0 && (
            <p style={{ textAlign: 'center', color: '#6b7280' }}>보유 중인 주식이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
