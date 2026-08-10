(function(){
  const db = window.skyeSupabase;
  if (!db) {
    alert('SKYE could not initialise its secure connection. Please refresh the page and try again.');
    console.error('SKYE Supabase client missing');
    return;
  }

  const PENDING_KEY = 'skye_pending_company';

  function showApp(companyName){
    const login = document.getElementById('login');
    const app = document.getElementById('app');
    const workspace = document.getElementById('workspaceName');
    if (workspace) workspace.textContent = companyName || 'Company';
    if (login) login.classList.add('hidden');
    if (app) app.classList.remove('hidden');
  }

  function showLogin(){
    const login = document.getElementById('login');
    const app = document.getElementById('app');
    if (app) app.classList.add('hidden');
    if (login) login.classList.remove('hidden');
  }

  async function getMembership(userId){
    const { data, error } = await db
      .from('company_members')
      .select('company_id, role, companies(name)')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  async function ensureWorkspace(user){
    let membership = await getMembership(user.id);
    if (membership) return membership;

    const pending = localStorage.getItem(PENDING_KEY);
    if (!pending) return null;

    let pendingData;
    try { pendingData = JSON.parse(pending); } catch (_) { pendingData = null; }
    const companyName = pendingData && pendingData.company ? pendingData.company.trim() : '';
    if (!companyName) return null;

    const { data: companyId, error: createError } = await db
      .rpc('create_company_workspace', { p_company_name: companyName });

    if (createError) throw createError;

    localStorage.removeItem(PENDING_KEY);
    membership = await getMembership(user.id);

    if (!membership && companyId) {
      return { company_id: companyId, role: 'admin', companies: { name: companyName } };
    }
    return membership;
  }

  window.signIn = async function(){
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const companyInput = document.getElementById('company').value.trim();

    if(!email || !password){
      alert('Enter your email address and password.');
      return;
    }

    const button = document.querySelector('#login .primary');
    if (button) { button.disabled = true; button.textContent = 'Signing in…'; }

    try {
      const { data, error } = await db.auth.signInWithPassword({ email, password });
      if (error) throw error;

      const membership = await ensureWorkspace(data.user);
      if (!membership) {
        await db.auth.signOut();
        throw new Error('Your account is authenticated, but it is not linked to a SKYE company workspace yet.');
      }

      const companyName = membership.companies && membership.companies.name
        ? membership.companies.name
        : 'Company';

      if (companyInput && companyInput.toLowerCase() !== companyName.toLowerCase()) {
        await db.auth.signOut();
        throw new Error('The company entered does not match the workspace linked to this account.');
      }

      showApp(companyName);
    } catch (err) {
      console.error(err);
      alert(err.message || 'Unable to sign in.');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Sign in to SKYE'; }
    }
  };

  window.createAccount = async function(){
    const company = document.getElementById('company').value.trim();
    const admin = document.getElementById('admin').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirm = document.getElementById('confirm').value;

    if(!company || !admin || !email || !password || !confirm){
      alert('Please complete all fields.'); return;
    }
    if(!email.includes('@') || !email.includes('.')){
      alert('Please enter a valid work email address.'); return;
    }
    if(password.length < 8 || !/[0-9]/.test(password)){
      alert('Password must be at least 8 characters and contain a number.'); return;
    }
    if(password !== confirm){
      alert('Passwords do not match.'); return;
    }

    const button = document.querySelector('#formView .primary');
    if (button) { button.disabled = true; button.textContent = 'Creating account…'; }

    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ company, admin, email }));

      const { data, error } = await db.auth.signUp({
        email,
        password,
        options: { data: { full_name: admin } }
      });
      if (error) throw error;

      if (data.session && data.user) {
        const membership = await ensureWorkspace(data.user);
        if (!membership) throw new Error('Account created, but the company workspace could not be created yet.');
        localStorage.removeItem(PENDING_KEY);
      }

      const successText = document.querySelector('#successView p');
      if (successText) {
        successText.textContent = data.session
          ? 'Your SKYE account and private company workspace are ready.'
          : 'Your account has been created. Check your email to confirm your address, then sign in. Your private company workspace will be created automatically on your first sign-in.';
      }
      document.getElementById('createdCompany').textContent = company;
      document.getElementById('formView').style.display = 'none';
      document.getElementById('successView').style.display = 'block';
    } catch (err) {
      console.error(err);
      localStorage.removeItem(PENDING_KEY);
      alert(err.message || 'Unable to create the account.');
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Create company workspace'; }
    }
  };

  window.logout = async function(){
    await db.auth.signOut();
    showLogin();
  };

  document.addEventListener('DOMContentLoaded', async function(){
    const { data } = await db.auth.getSession();
    if (!data.session) return;

    try {
      const membership = await ensureWorkspace(data.session.user);
      if (membership) {
        const companyName = membership.companies && membership.companies.name
          ? membership.companies.name
          : 'Company';
        if (document.getElementById('app')) showApp(companyName);
      }
    } catch (err) {
      console.error('Session restore failed:', err);
      await db.auth.signOut();
      showLogin();
    }
  });
})();
