'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // includes balance, job, etc.
  const [currency, setCurrency] = useState('미소');
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
    
    // Subscribe to settings changes for currency
    const settingsSub = supabase.channel('public:settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: "key=eq.currency_name" }, (payload) => {
        if (payload.new && payload.new.value) setCurrency(payload.new.value);
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
    
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, role, currency, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
