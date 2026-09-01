'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import useInventoryStore from '@/store/useInventoryStore';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // includes balance, job, etc.
  const [currency, setCurrency] = useState('돈');
  const [treasury, setTreasury] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    };

    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserRole(session.user.id);
      } else {
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    });
    
    // Subscribe to settings changes for currency and treasury
    const settingsSub = supabase.channel('public:settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
        if (payload.new) {
          if (payload.new.key === 'currency_name') setCurrency(payload.new.value);
          if (payload.new.key === 'treasury_balance') setTreasury(parseInt(payload.new.value || '0', 10));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(settingsSub);
    };
  }, []);
  
  useEffect(() => {
    let userSub;
    if (user) {
      userSub = supabase.channel(`public:users:${user.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` }, (payload) => {
          setRole(prev => ({ ...prev, balance: payload.new.balance, job: payload.new.job }));
        })
        .subscribe();
    }
    return () => {
      if (userSub) supabase.removeChannel(userSub);
    }
  }, [user]);

  const fetchUserRole = async (userId) => {
    const { data, error } = await supabase
      .from('users')
      .select('role, name, department, balance, job')
      .eq('id', userId)
      .single();
    
    if (data) {
      setRole(data);
    }
    
    const { data: curData } = await supabase.from('settings').select('value').eq('key', 'currency_name').single();
    if (curData) setCurrency(curData.value);
    
    const { data: tresData } = await supabase.from('settings').select('value').eq('key', 'treasury_balance').single();
    if (tresData) setTreasury(parseInt(tresData.value || '0', 10));
    
    // Fetch completed quests to prevent repeating
    const { data: questLogs } = await supabase
      .from('activity_logs')
      .select('details')
      .eq('user_id', userId)
      .eq('action_type', 'QUEST_COMPLETED');
    
    if (questLogs) {
      const completedTitles = questLogs.map(log => log.details?.title).filter(Boolean);
      useInventoryStore.getState().setCompletedQuests(completedTitles);
    }
    
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, role, currency, treasury, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
