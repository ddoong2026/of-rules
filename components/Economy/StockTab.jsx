'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

export default function StockTab() {
  const { user, currency, role, refreshUser } = useAuth();
  const [stocks, setStocks] = useState([]); const [holdings, setHoldings] = useState([]); const [orders, setOrders] = useState([]);
  const load = async () => {
    const [a,b,c] = await Promise.all([
      supabase.from('stocks').select('*, stock_teams(name,code,dividend_pool)').not('team_id','is',null).order('name'),
      supabase.from('user_stocks').select('*, stocks(name,current_price,team_id)').eq('user_id',user.id),
      supabase.from('stock_orders').select('*, stocks(name)').eq('user_id',user.id).eq('status','OPEN').order('created_at',{ascending:false})
    ]);
    setStocks(a.data || []); setHoldings(b.data || []); setOrders(c.data || []);
  };
  useEffect(() => { if (user) load(); }, [user]);
  const order = async (stock, side) => {
    const quantity = Number(prompt(`${stock.name} ${side === 'BUY' ? '매수' : '매도'} 수량`));
    const price = Number(prompt(`희망 ${side === 'BUY' ? '매수가' : '매도가'} (${currency})\n최근 체결가: ${stock.current_price}`));
    if (!Number.isInteger(quantity) || quantity <= 0 || !Number.isInteger(price) || price <= 0) return;
    const { error } = await supabase.rpc('place_team_stock_order', { p_stock_id: stock.id, p_side: side, p_quantity: quantity, p_limit_price: price });
    if (error) return alert(error.message); alert('주문이 접수되었습니다. 조건에 맞는 주문이 있으면 즉시 체결됩니다.'); load(); refreshUser();
  };
  const cancel = async (id) => { await supabase.rpc('cancel_team_stock_order',{p_order_id:id}); load(); };
  if (!user) return null;
  return <div style={{display:'grid',gap:'1.25rem'}}>
    <div><h2 style={{color:'var(--primary)'}}>📈 모둠 주식 거래소</h2><p>가격은 마지막 실제 체결가입니다. 매수·매도 희망 가격이 만날 때만 거래됩니다.</p></div>
    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(230px,1fr))',gap:'1rem'}}>{stocks.map(stock => <div className="glass-panel" key={stock.id} style={{padding:'1rem'}}>
      <b>{stock.stock_teams?.name}</b> <small>({stock.stock_teams?.code})</small><h3>{stock.current_price.toLocaleString()} {currency}</h3>
      <p style={{fontSize:'0.85rem'}}>배당 재원: {stock.stock_teams?.dividend_pool?.toLocaleString() || 0} {currency}<br/>발행 주식: {stock.issued_shares}주</p>
      <div style={{display:'flex',gap:'0.5rem'}}><button className="glass-button" disabled={role?.role==='GUEST_MATH'} onClick={()=>order(stock,'BUY')}>매수 주문</button><button className="glass-button" disabled={role?.role==='GUEST_MATH'} onClick={()=>order(stock,'SELL')}>매도 주문</button></div>
    </div>)}</div>
    <div className="glass-panel" style={{padding:'1rem'}}><h3>💼 내 보유 주식</h3>{holdings.length ? holdings.map(h => <p key={h.id}>{h.stocks?.name}: <b>{h.quantity}주</b> · 평단 {Math.round(h.average_price)} · 평가 {Math.round(h.quantity*h.stocks.current_price).toLocaleString()} {currency}</p>) : <p>보유 주식이 없습니다.</p>}</div>
    <div className="glass-panel" style={{padding:'1rem'}}><h3>🧾 내 미체결 주문</h3>{orders.length ? orders.map(o => <p key={o.id}>{o.stocks?.name} {o.side==='BUY'?'매수':'매도'} {o.remaining_quantity}주 @ {o.limit_price} <button onClick={()=>cancel(o.id)}>취소</button></p>) : <p>미체결 주문이 없습니다.</p>}</div>
  </div>;
}
