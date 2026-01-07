jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
  }));
  
  jest.mock('expo-router', () => ({
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    }),
    useSegments: () => [],
    usePathname: () => '/',
    router: {
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    },
    Link: 'Link',
  }));
  
  // Mock Supabase client
  jest.mock('@/lib/supabase', () => ({
    supabase: {
      auth: {
        getUser: jest.fn(),
        signInWithPassword: jest.fn(),
        signUp: jest.fn(),
        signOut: jest.fn(),
        signInWithOAuth: jest.fn(),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
      },
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        maybeSingle: jest.fn(),
      })),
      storage: {
        from: jest.fn(() => ({
          upload: jest.fn(),
          remove: jest.fn(),
          createSignedUrl: jest.fn(),
        })),
      },
    },
  }));
  
  // Silence console warnings in tests
  global.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn(),
  };