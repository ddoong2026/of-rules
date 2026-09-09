'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import styles from './StockTab.module.css';

export default function StockTab() {
  const { user, currency, role, refreshUser } = useAuth();
  const [stocks, setStocks] = useState([]); const [holdings, setHoldings] = useState([]); const [orders, setOrders] = useState([]); const [overview, setOverview] = useState([]);
  const load = async () => {
    const [a,b,c,d] = await Promise.all([
      supabase.from('stocks').select('*, stock_teams(name,code,dividend_pool)').not('team_id','is',null).order('name'),
      supabase.from('user_stocks').select('*, stocks(name,current_price,team_id)').eq('user_id',user.id),
      supabase.from('stock_orders').select('*, stocks(name)').eq('user_id',user.id).eq('status','OPEN').order('created_at',{ascending:false})
      ,supabase.rpc('get_team_stock_overview')
    ]);
    setStocks(a.data || []); setHoldings(b.data || []); setOrders(c.data || []); setOverview(d.data || []);
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
  return <div className={styles.page}>
    <div className={`glass-panel ${styles.hero}`}><h2>🌟 우리 모둠 응원 투자소</h2><p>친구들의 노력으로 배당 재원이 쌓여요. 원하는 가격이 만나면 거래가 이루어져요.</p></div>
    <div className={styles.stockGrid}>{stocks.map(stock => <div className={`glass-panel ${styles.stockCard}`} key={stock.id}>
      <div className={styles.teamTitle}>{stock.stock_teams?.name} <span className={styles.code}>({stock.stock_teams?.code})</span></div><h3 className={styles.price}>{stock.current_price.toLocaleString()} {currency}</h3>
      <p className={styles.facts}>🍀 배당 재원 {stock.stock_teams?.dividend_pool?.toLocaleString() || 0} {currency}<br/>🎟️ 발행 주식 {stock.issued_shares}주</p>
      <div className={styles.tradeButtons}><button className={`glass-button ${styles.buy}`} disabled={role?.role==='GUEST_MATH'} onClick={()=>order(stock,'BUY')}>응원 주식 사기</button><button className={`glass-button ${styles.sell}`} disabled={role?.role==='GUEST_MATH'} onClick={()=>order(stock,'SELL')}>주식 팔기</button></div>
    </div>)}</div>
    <div className={`glass-panel ${styles.section}`}><h3>🎒 내가 가진 응원 주식</h3>{holdings.length ? holdings.map(h => <div className={styles.holding} key={h.id}>{h.stocks?.name}: <b>{h.quantity}주</b> · 산 가격 {Math.round(h.average_price)} · 지금 가치 {Math.round(h.quantity*h.stocks.current_price).toLocaleString()} {currency}</div>) : <p className={styles.empty}>아직 가진 주식이 없어요. 마음에 드는 모둠을 응원해 보세요!</p>}</div>
    <div className={`glass-panel ${styles.section}`}><h3>👥 모둠 친구들과 배당 소식</h3><div className={styles.overviewGrid}>{overview.map(team => <div key={team.team_id} className={styles.overviewCard}><b>{team.name}</b> <span className={styles.code}>({team.code})</span><p>🎟️ 발행 {team.issued_shares}주 · 친구들이 가진 주식 {team.total_held}주<br/>🍀 모인 배당 {team.dividend_pool.toLocaleString()} {currency}<br/>🎁 지금 나누면 1주당 약 {team.estimated_dividend_per_share.toLocaleString()} {currency}</p><details><summary>주주 {team.shareholders.length}명 보기</summary>{team.shareholders.length ? <ul>{team.shareholders.map(owner=><li key={owner.student_number}>{owner.name} · {owner.quantity}주</li>)}</ul> : <p>아직 주주가 없어요.</p>}</details></div>)}</div></div>
    <div className={`glass-panel ${styles.section}`}><h3>⏳ 기다리는 내 주문</h3>{orders.length ? orders.map(o => <div className={styles.order} key={o.id}>{o.stocks?.name} {o.side==='BUY'?'사기':'팔기'} {o.remaining_quantity}주 · {o.limit_price} {currency}<button className={styles.cancel} onClick={()=>cancel(o.id)}>주문 취소</button></div>) : <p className={styles.empty}>기다리는 주문이 없어요.</p>}</div>
  </div>;
}
