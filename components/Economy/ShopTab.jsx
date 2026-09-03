'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';

export default function ShopTab() {
  const { user, currency, role } = useAuth();
  const [items, setItems] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchItems();
    fetchMyPurchases();
  }, [user]);

  async function fetchItems() {
    const { data } = await supabase
      .from('shop_items')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (data) setItems(data);
  };

  async function fetchMyPurchases() {
    if (!user) return;
    const { data } = await supabase
      .from('purchases')
      .select('*, shop_items(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setPurchases(data);
    setLoading(false);
  };

  const handleBuy = async (item) => {
    if ((role?.balance || 0) < item.price) {
      return alert('잔액이 부족합니다!');
    }
    
    if (confirm(`'${item.name}' 아이템을 ${item.price.toLocaleString()}${currency}에 구매하시겠습니까?`)) {
      // Deduct balance and record purchase
      const { error: txError } = await supabase.rpc('process_transaction', {
        p_user_id: user.id,
        p_amount: -item.price,
        p_description: `상점 구매: ${item.name}`,
        p_type: 'SHOP'
      });

      if (txError) {
        return alert('구매 중 오류가 발생했습니다.');
      }

      await supabase.from('purchases').insert([{
        user_id: user.id,
        item_id: item.id,
        price_paid: item.price
      }]);

      alert('구매가 완료되었습니다!');
      fetchMyPurchases();
      window.dispatchEvent(new CustomEvent('show-pet'));
    }
  };

  if (loading) return <div>로딩중...</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
      <div>
        <h2 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>🛒 상점 아이템</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
          {items.map(item => (
            <div key={item.id} className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', transition: 'transform 0.2s', cursor: 'pointer' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{item.name}</h3>
              <p style={{ color: 'var(--primary)', fontWeight: 'bold', fontSize: '1.5rem', marginBottom: '1rem' }}>
                {item.price.toLocaleString()} {currency}
              </p>
              <button 
                className="glass-button" 
                style={{ width: '100%', background: role?.role === 'GUEST_MATH' ? '#9ca3af' : 'var(--secondary)', color: 'white', cursor: role?.role === 'GUEST_MATH' ? 'not-allowed' : 'pointer' }}
                onClick={() => handleBuy(item)}
                disabled={role?.role === 'GUEST_MATH'}
                title={role?.role === 'GUEST_MATH' ? '수학 체험 전용 계정은 읽기만 가능합니다.' : ''}
              >
                구매하기
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#6b7280' }}>현재 판매 중인 아이템이 없습니다.</p>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h2 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>📦 내 보관함</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {purchases.map(p => (
            <li key={p.id} style={{ padding: '0.8rem', borderBottom: '1px solid rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between' }}>
              <span>{p.shop_items?.name}</span>
              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>{new Date(p.created_at).toLocaleDateString()}</span>
            </li>
          ))}
          {purchases.length === 0 && (
            <li style={{ textAlign: 'center', color: '#6b7280' }}>보유한 아이템이 없습니다.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
