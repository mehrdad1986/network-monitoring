import { useState, FormEvent, memo } from 'react';
import './Home.css';

// Static geometry keeps the motion independent of form state and React renders.
const wireSculpture = Array.from({ length: 40 }, (_, ring) => {
  const latitude = ring < 24;
  const fixed = (ring / (latitude ? 24 : 16)) * Math.PI * 2;
  const points = Array.from({ length: 97 }, (_, step) => {
    const moving = step / 96 * Math.PI * 2;
    const u = latitude ? fixed : moving;
    const v = latitude ? moving : fixed;
    const x = (126 + 49 * Math.cos(v)) * Math.cos(u);
    const y = (126 + 49 * Math.cos(v)) * Math.sin(u);
    const z = 49 * Math.sin(v);
    const tiltY = y * 0.46 - z * 0.89;
    return `${(300 + x * 0.94 - tiltY * 0.34).toFixed(1)},${(210 + x * 0.34 + tiltY * 0.94).toFixed(1)}`;
  }).join(' ');
  return { points, hue: 173 + ring * 4 };
});

const meshPoints = Array.from({ length: 35 }, (_, i) => {
  const row = Math.floor(i / 7), col = i % 7;
  return { x: 105 + col * 65 + (row % 2) * 25, y: 94 + row * 60 + Math.sin(col * 1.3 + row) * 23 };
});

function ShowcaseArt({ scene }: { scene: number }) {
  return (
    <svg className={`showcase-art showcase-art-${scene}`} viewBox="0 0 600 420" fill="none" aria-hidden="true">
      {scene === 0 && <>
        <g className="showcase-guide" transform="translate(300 210) rotate(-22)">
          {[0, 1, 2, 3, 4].map(i => <ellipse key={i} rx={100 + i * 31} ry={45 + i * 15} />)}
          <path d="M-245 0H245M0-130V130" />
        </g>
        <path className="showcase-route-shadow" d="M90 278L174 232L250 252L322 159L410 180L506 103" />
        <path className="showcase-route showcase-travel" d="M90 278L174 232L250 252L322 159L410 180L506 103" />
        {[[90,278],[174,232],[250,252],[322,159],[410,180],[506,103]].map(([x,y],i) => <g key={i}>
          <circle cx={x} cy={y} r="13" fill="#101a2b" stroke={`hsl(${178 + i * 25}, 90%, 70%)`} strokeOpacity="0.5" />
          <circle cx={x} cy={y} r="4" fill={`hsl(${178 + i * 25}, 90%, 75%)`} />
          <text className="showcase-micro-label" x={x} y={y+31}>0{i+1}</text>
        </g>)}
      </>}
      {scene === 1 && <>
        <g className="showcase-guide">
          <circle cx="300" cy="210" r="152" /><circle cx="300" cy="210" r="117" />
          <path d="M80 210H520M300 38V382" />
        </g>
        <g className="showcase-checkpoint-orbit">
          <ellipse cx="300" cy="210" rx="215" ry="93" transform="rotate(-30 300 210)" stroke="url(#showcase-spectrum)" strokeWidth="1.2" />
          <ellipse cx="300" cy="210" rx="215" ry="93" transform="rotate(30 300 210)" stroke="url(#showcase-spectrum-alt)" strokeWidth="1.2" />
        </g>
        <path d="M300 107L389 158V262L300 313L211 262V158Z" fill="#111a2b" stroke="url(#showcase-spectrum)" strokeWidth="1.5" />
        <path d="M300 128L371 169V251L300 292L229 251V169Z" stroke="#b2a4ff" strokeOpacity="0.35" />
        <path d="M263 208L290 235L340 184" stroke="url(#showcase-spectrum-alt)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        {[[118,130],[480,290],[121,286],[483,128]].map(([x,y],i)=><g key={i}><circle cx={x} cy={y} r="7" fill={i%2 ? '#b4a1ff' : '#7cece8'} /><circle cx={x} cy={y} r="17" stroke={i%2 ? '#b4a1ff' : '#7cece8'} strokeOpacity="0.3" /></g>)}
      </>}
      {scene === 2 && <>
        <ellipse className="showcase-floor" cx="300" cy="342" rx="172" ry="17" fill="url(#showcase-floor-glow)" />
        <g className="showcase-wire-sculpture">
          {wireSculpture.map((wire,i)=><polyline key={i} points={wire.points} stroke={`hsl(${wire.hue}, 94%, 70%)`} strokeWidth={i%5===0 ? 1.5 : 0.7} opacity={i%5===0 ? 0.95 : 0.55} />)}
        </g>
      </>}
      {scene === 3 && <>
        <g className="showcase-globe" transform="rotate(-20 300 210)" stroke="url(#showcase-spectrum)">
          <circle cx="300" cy="210" r="143" strokeWidth="1.5" />
          {[30,62,102].map(r=><ellipse key={r} cx="300" cy="210" rx={r} ry="143" opacity="0.65" />)}
          {[-100,-55,0,55,100].map(y=><ellipse key={y} cx="300" cy={210+y} rx={Math.sqrt(143*143-y*y)} ry={19+(100-Math.abs(y))*0.18} opacity="0.55" />)}
        </g>
        <ellipse className="showcase-world-orbit" cx="300" cy="210" rx="228" ry="68" transform="rotate(-24 300 210)" stroke="url(#showcase-spectrum-alt)" strokeWidth="1.8" />
        <path className="showcase-travel" d="M130 271Q295 2 458 113" stroke="#c6b3ff" strokeWidth="2" />
        <circle cx="432" cy="117" r="6" fill="#e4c8ff" /><circle cx="189" cy="279" r="5" fill="#80fff0" />
      </>}
      {scene === 4 && <>
        <g className="showcase-guide"><ellipse cx="300" cy="218" rx="218" ry="102" /><path d="M70 220H530M300 70V350" /></g>
        {Array.from({length:39},(_,i)=>{
          const height=28+Math.pow(Math.sin(i/38*Math.PI),2)*155+Math.sin(i*1.8)*18;
          return <line className={`showcase-spectrum-bar bar-${i%4}`} key={i} x1={91+i*11} x2={91+i*11} y1={218-height/2} y2={218+height/2} stroke={`hsl(${173+i*4.5}, 90%, 70%)`} strokeWidth="4" strokeLinecap="round" />;
        })}
        <path d="M70 222C160 222 166 132 230 170S328 293 382 219S479 194 530 194" stroke="url(#showcase-spectrum-alt)" strokeWidth="1.2" opacity="0.65" />
      </>}
      {scene === 5 && <>
        <g className="showcase-stream">
          {Array.from({length:19},(_,i)=>{
            const x=30+i*30;
            return <path key={i} d={`M${x} 35Q${300+(x-300)*0.2} 210 ${x} 385`} stroke={`hsl(${175+i*8}, 90%, 70%)`} strokeWidth={i%3===0 ? 1.5 : 0.65} opacity={i%3===0 ? 0.9 : 0.35} />;
          })}
          {[0,1,2,3,4,5,6].map(i=><ellipse className="showcase-stream-ring" key={i} cx="300" cy="210" rx={30+i*35} ry={15+i*19} stroke="url(#showcase-spectrum)" opacity={0.65-i*0.06} />)}
        </g>
        <path className="showcase-route showcase-travel" d="M60 370Q300 10 540 370" />
        <ellipse cx="300" cy="210" rx="35" ry="17" fill="#9cf3f012" stroke="#a8fcf4" />
      </>}
      {scene === 6 && <>
        <g className="showcase-mesh">
          {meshPoints.map((p,i)=><g key={i}>
            {i%7<6 && <path d={`M${p.x} ${p.y}L${meshPoints[i+1].x} ${meshPoints[i+1].y}`} stroke="url(#showcase-spectrum)" strokeOpacity="0.6" />}
            {i<28 && <path d={`M${p.x} ${p.y}L${meshPoints[i+7].x} ${meshPoints[i+7].y}`} stroke="url(#showcase-spectrum-alt)" strokeOpacity="0.45" />}
            {i<28 && i%7<6 && <path d={`M${p.x} ${p.y}L${meshPoints[i+8].x} ${meshPoints[i+8].y}`} stroke="#9ea3ff" strokeOpacity="0.2" />}
            <circle cx={p.x} cy={p.y} r={i%4===0 ? 4 : 2} fill={`hsl(${175+i*4.8}, 90%, 75%)`} />
          </g>)}
        </g>
        <path className="showcase-travel" d="M105 94L195 177L235 237L325 299L390 276L455 310" stroke="#c1b5ff" strokeWidth="2" />
      </>}
    </svg>
  );
}

const showcaseScenes = [
  { title: 'Traceroute', caption: 'Every hop. A new perspective.', category: 'PATH INTELLIGENCE' },
  { title: 'BGP Checkpoint', caption: 'Where every route connects.', category: 'ROUTING INTELLIGENCE' },
  { title: 'Future wired.', caption: 'A different kind of connection.', category: 'CONNECTED BY DESIGN' },
  { title: 'Global reach.', caption: 'Beyond the edge of your network.', category: 'A WORLD OF CONNECTIONS' },
  { title: 'Signal flow.', caption: 'Find clarity in the frequency.', category: 'PERFORMANCE IN MOTION' },
  { title: 'Packet stream.', caption: 'Small signals. Infinite possibilities.', category: 'BUILT TO MOVE' },
  { title: 'Connected.', caption: 'One network. Every possibility.', category: 'THE BIGGER PICTURE' },
];

const NetworkShowcase = memo(function NetworkShowcase() {
  const [paused, setPaused] = useState(false);
  return (
    <aside className="home-right network-showcase" aria-label="Network intelligence showcase" data-paused={paused}>
      <div className="showcase-topline"><span className="showcase-kicker">THE ART OF CONNECTION</span><span className="showcase-edition">NetMon / 001</span></div>
      <div className="showcase-canvas" role="img" aria-label="Seven animated perspectives: Traceroute, BGP Checkpoint, futuristic wires, a globe, signal waves, packet streams and a connected mesh.">
        <svg className="showcase-definitions" aria-hidden="true" width="0" height="0">
          <defs>
            <linearGradient id="showcase-spectrum" x1="100" y1="100" x2="500" y2="320" gradientUnits="userSpaceOnUse"><stop stopColor="#68f5dc" /><stop offset="0.35" stopColor="#6ed6ff" /><stop offset="0.7" stopColor="#a592ff" /><stop offset="1" stopColor="#f49fd8" /></linearGradient>
            <linearGradient id="showcase-spectrum-alt" x1="120" y1="310" x2="480" y2="80" gradientUnits="userSpaceOnUse"><stop stopColor="#78f3e4" /><stop offset="0.48" stopColor="#bc9bff" /><stop offset="1" stopColor="#ffd19c" /></linearGradient>
            <radialGradient id="showcase-floor-glow"><stop stopColor="#8f77ff" stopOpacity="0.3" /><stop offset="1" stopColor="#8f77ff" stopOpacity="0" /></radialGradient>
          </defs>
        </svg>
        <div className="showcase-aurora" aria-hidden="true" />
        <div className="showcase-coordinate coordinate-top" aria-hidden="true">EXPLORING THE INVISIBLE</div>
        <div className="showcase-coordinate coordinate-left" aria-hidden="true">N / 07</div>
        <div className="showcase-scenes" aria-hidden="true">
          {showcaseScenes.map((scene,index)=><div className={`showcase-scene scene-${index}`} key={scene.title}>
            <div className="showcase-art-motion"><ShowcaseArt scene={index} /></div>
            <div className="showcase-scene-copy"><span className="showcase-category">{scene.category}</span><h2>{scene.title}</h2><p>{scene.caption}</p></div>
            <span className="showcase-scene-count">0{index+1}<span> / 07</span></span>
          </div>)}
        </div>
      </div>
      <div className="showcase-bottomline">
        <div className="showcase-sequence" aria-hidden="true">{showcaseScenes.map((scene,i)=><span className={`sequence-step scene-${i}`} key={scene.title} />)}</div>
        <button className="showcase-toggle" type="button" aria-pressed={paused} aria-label={paused ? 'Play network animation' : 'Pause network animation'} onClick={()=>setPaused(value=>!value)}>
          {paused ? <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1L11 6L3 11Z" /></svg> : <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M2 1H5V11H2ZM7 1H10V11H7Z" /></svg>}
          {paused ? 'Play' : 'Pause'}
        </button>
      </div>
      <p className="showcase-signoff">A world of signals.<span> One clear vision.</span></p>
    </aside>
  );
});

interface HomeProps {
  onLogin: (token: string, user: any) => void;
}

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export const Home = ({ onLogin }: HomeProps) => {
  const [isSignIn, setIsSignIn] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState({
    username: false,
    email: false,
    password: false,
    confirmPassword: false
  });

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const getPasswordStrength = (password: string): { strength: number; label: string; color: string } => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 15;
    if (/[a-z]/.test(password)) strength += 15;
    if (/[A-Z]/.test(password)) strength += 15;
    if (/[0-9]/.test(password)) strength += 15;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 15;

    if (strength < 40) return { strength, label: 'Weak', color: '#ef4444' };
    if (strength < 70) return { strength, label: 'Fair', color: '#f97316' };
    if (strength < 90) return { strength, label: 'Good', color: '#facc15' };
    return { strength, label: 'Strong', color: '#4ade80' };
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      newErrors.username = 'Username can only contain letters, numbers, dashes and underscores';
    }

    if (!isSignIn) {
      if (!email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!validateEmail(email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!isSignIn) {
      if (!confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (password !== confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    onLogin('mock_token_' + Date.now(), {
      username,
      email: email || `${username}@example.com`,
      loginTime: new Date().toISOString()
    });

    setLoading(false);
  };

  const handleOAuth = (provider: string) => {
    setLoading(true);
    setTimeout(() => {
      onLogin('mock_oauth_token_' + provider, {
        username: `${provider}_user`,
        provider,
        loginTime: new Date().toISOString()
      });
      setLoading(false);
    }, 1000);
  };

  const handleBlur = (field: keyof typeof touched) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateForm();
  };

  const handleInputChange = (field: string, value: string) => {
    switch (field) {
      case 'username':
        setUsername(value);
        break;
      case 'email':
        setEmail(value);
        break;
      case 'password':
        setPassword(value);
        break;
      case 'confirmPassword':
        setConfirmPassword(value);
        break;
    }

    if (touched[field as keyof typeof touched]) {
      validateForm();
    }
  };

  const switchMode = () => {
    setIsSignIn(!isSignIn);
    setErrors({});
    setTouched({
      username: false,
      email: false,
      password: false,
      confirmPassword: false
    });
    setPassword('');
    setConfirmPassword('');
  };

  const passwordStrength = !isSignIn && password ? getPasswordStrength(password) : null;

  return (
    <div className="home-container">
      <header className="auth-brandbar">
        <a className="auth-brand" href="/" aria-label="NetMon home">
          <span className="brand-symbol" aria-hidden="true">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L29 9.5V22.5L16 30L3 22.5V9.5L16 2Z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10 12.5L16 9L22 12.5V19.5L16 23L10 19.5V12.5Z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M16 2V9M29 22.5L22 19M3 22.5L10 19" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </span>
          <span className="brand-wordmark">NetMon</span>
          <span className="brand-divider" aria-hidden="true" />
          <span className="brand-caption">Network intelligence</span>
        </a>
        <span className="brand-context">Built for network operations <span aria-hidden="true">↗</span></span>
      </header>

      <main className="auth-stage">
      <section className="home-left" aria-labelledby="auth-heading">
        <div className="auth-box">
          <div className="auth-header">
            <span className="auth-eyebrow"><span aria-hidden="true" />Workspace access</span>
            <h1 id="auth-heading" className="auth-title">{isSignIn ? 'Welcome back.' : 'Your next connection.'}</h1>
            <p className="auth-subtitle">{isSignIn ? 'Sign in to your network workspace.' : 'Create your NetMon workspace account.'}</p>
          </div>

          <div className="form-tabs" role="group" aria-label="Account access mode">
            <button
              className={`tab ${isSignIn ? 'active' : ''}`}
              aria-pressed={isSignIn}
              onClick={() => { if (!isSignIn) switchMode(); }}
              type="button"
              disabled={loading}
            >
              Sign In
            </button>
            <button
              className={`tab ${!isSignIn ? 'active' : ''}`}
              aria-pressed={!isSignIn}
              onClick={() => { if (isSignIn) switchMode(); }}
              type="button"
              disabled={loading}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleAuth} className="auth-form" noValidate>
            <div className="input-group">
              <label htmlFor="username" className="input-label">
                Username
                <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 10C12.2091 10 14 8.20914 14 6C14 3.79086 12.2091 2 10 2C7.79086 2 6 3.79086 6 6C6 8.20914 7.79086 10 10 10Z" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M2 18C2 14.6863 4.68629 12 8 12H12C15.3137 12 18 14.6863 18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  onBlur={() => handleBlur('username')}
                  className={errors.username && touched.username ? 'error' : ''}
                  autoComplete="username"
                  disabled={loading}
                  aria-invalid={errors.username && touched.username ? 'true' : 'false'}
                  aria-describedby={errors.username ? 'username-error' : undefined}
                />
                {username && !errors.username && (
                  <svg className="input-check" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="9" stroke="#4ade80" strokeWidth="1.5"/>
                    <path d="M6 10L9 13L14 7" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              {errors.username && touched.username && (
                <div className="input-error" id="username-error" role="alert">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 4V9M8 11V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {errors.username}
                </div>
              )}
            </div>

            {!isSignIn && (
              <div className="input-group">
                <label htmlFor="email" className="input-label">
                  Email Address
                  <span className="required">*</span>
                </label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M2 5L10 10L18 5M2 5V15H18V5M2 5H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <input
                    id="email"
                    type="email"
                    placeholder="your.email@company.com"
                    value={email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    onBlur={() => handleBlur('email')}
                    className={errors.email && touched.email ? 'error' : ''}
                    autoComplete="email"
                    disabled={loading}
                    aria-invalid={errors.email && touched.email ? 'true' : 'false'}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                  />
                  {email && validateEmail(email) && !errors.email && (
                    <svg className="input-check" width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="9" stroke="#4ade80" strokeWidth="1.5"/>
                      <path d="M6 10L9 13L14 7" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {errors.email && touched.email && (
                  <div className="input-error" id="email-error" role="alert">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8 4V9M8 11V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {errors.email}
                  </div>
                )}
              </div>
            )}

            <div className="input-group">
              <label htmlFor="password" className="input-label">
                Password
                <span className="required">*</span>
              </label>
              <div className="input-wrapper">
                <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <rect x="4" y="9" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M7 9V6C7 4.34315 8.34315 3 10 3C11.6569 3 13 4.34315 13 6V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="10" cy="13.5" r="1" fill="currentColor"/>
                </svg>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  onBlur={() => handleBlur('password')}
                  className={errors.password && touched.password ? 'error' : ''}
                  autoComplete={isSignIn ? 'current-password' : 'new-password'}
                  disabled={loading}
                  aria-invalid={errors.password && touched.password ? 'true' : 'false'}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M2 2L18 18M8.88 8.88C8.33249 9.42751 8.00004 10.1851 8 11C8 12.6569 9.34315 14 11 14C11.8149 13.9999 12.5725 13.6675 13.12 13.12M5.18 5.18C3.45 6.53 2.12 8.45 2 10C2.49 13.45 6.2 16 11 16C12.58 16 14.04 15.63 15.32 15M11 4C6.2 4 2.49 6.55 2 10C2.49 13.45 6.2 16 11 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path d="M2 10C2 10 5 4 10 4C15 4 18 10 18 10C18 10 15 16 10 16C5 16 2 10 2 10Z" stroke="currentColor" strokeWidth="1.5"/>
                      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && touched.password && (
                <div className="input-error" id="password-error" role="alert">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M8 4V9M8 11V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  {errors.password}
                </div>
              )}
              {!isSignIn && password && !errors.password && passwordStrength && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div
                      className="strength-fill"
                      style={{
                        width: `${passwordStrength.strength}%`,
                        backgroundColor: passwordStrength.color
                      }}
                    ></div>
                  </div>
                  <div className="strength-label" style={{ color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </div>
                </div>
              )}
            </div>

            {!isSignIn && (
              <div className="input-group">
                <label htmlFor="confirmPassword" className="input-label">
                  Confirm Password
                  <span className="required">*</span>
                </label>
                <div className="input-wrapper">
                  <svg className="input-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <rect x="4" y="9" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M7 9V6C7 4.34315 8.34315 3 10 3C11.6569 3 13 4.34315 13 6V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="10" cy="13.5" r="1" fill="currentColor"/>
                  </svg>
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                    onBlur={() => handleBlur('confirmPassword')}
                    className={errors.confirmPassword && touched.confirmPassword ? 'error' : ''}
                    autoComplete="new-password"
                    disabled={loading}
                    aria-invalid={errors.confirmPassword && touched.confirmPassword ? 'true' : 'false'}
                    aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={loading}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M2 2L18 18M8.88 8.88C8.33249 9.42751 8.00004 10.1851 8 11C8 12.6569 9.34315 14 11 14C11.8149 13.9999 12.5725 13.6675 13.12 13.12M5.18 5.18C3.45 6.53 2.12 8.45 2 10C2.49 13.45 6.2 16 11 16C12.58 16 14.04 15.63 15.32 15M11 4C6.2 4 2.49 6.55 2 10C2.49 13.45 6.2 16 11 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M2 10C2 10 5 4 10 4C15 4 18 10 18 10C18 10 15 16 10 16C5 16 2 10 2 10Z" stroke="currentColor" strokeWidth="1.5"/>
                        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    )}
                  </button>
                  {confirmPassword && password === confirmPassword && !errors.confirmPassword && (
                    <svg className="input-check" width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <circle cx="10" cy="10" r="9" stroke="#4ade80" strokeWidth="1.5"/>
                      <path d="M6 10L9 13L14 7" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                {errors.confirmPassword && touched.confirmPassword && (
                  <div className="input-error" id="confirm-password-error" role="alert">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8 4V9M8 11V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    {errors.confirmPassword}
                  </div>
                )}
              </div>
            )}

            {isSignIn && (
              <div className="form-footer">
                <label className="remember-me">
                  <input type="checkbox" disabled={loading} />
                  <span className="checkbox-custom"></span>
                  <span>Remember me</span>
                </label>
                <button type="button" className="link-button" disabled={loading}>
                  Forgot password?
                </button>
              </div>
            )}

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? (
                <>
                  <span className="loading-spinner"></span>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {isSignIn ? 'Sign In' : 'Create Account'}
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M5 10H15M15 10L11 6M15 10L11 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="divider">
            <span>or continue with</span>
          </div>

          <div className="oauth-buttons">
            <button onClick={() => handleOAuth('google')} className="oauth-btn" type="button" disabled={loading}>
              <svg width="20" height="20" viewBox="0 0 20 20">
                <path fill="#4285F4" d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15.96-.74 2.31-2.04 3.22v2.45h3.16c1.89-1.73 2.98-4.3 2.98-7.34z"/>
                <path fill="#34A853" d="M13.46 15.13c-.83.59-1.96 1-3.46 1-2.64 0-4.88-1.74-5.68-4.15H1.07v2.52C2.72 17.75 6.09 20 10 20c2.7 0 4.96-.89 6.62-2.42l-3.16-2.45z"/>
                <path fill="#FBBC05" d="M3.99 10c0-.69.12-1.35.32-1.97V5.51H1.07A9.973 9.973 0 000 10c0 1.61.39 3.14 1.07 4.49l3.24-2.52c-.2-.62-.32-1.28-.32-1.97z"/>
                <path fill="#EA4335" d="M10 3.88c1.88 0 3.13.81 3.85 1.48l2.84-2.76C14.96.99 12.7 0 10 0 6.09 0 2.72 2.25 1.07 5.51l3.24 2.52C5.12 5.62 7.36 3.88 10 3.88z"/>
              </svg>
              Google
            </button>
            <button onClick={() => handleOAuth('github')} className="oauth-btn" type="button" disabled={loading}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd"/>
              </svg>
              GitHub
            </button>
          </div>

          <p className="auth-terms">
            By continuing, you agree to NetMon's <button type="button" className="terms-link">Terms of Service</button> and <button type="button" className="terms-link">Privacy Policy</button>
          </p>
        </div>
      </section>

      <NetworkShowcase />
      </main>
      <footer className="auth-page-footer"><span>Network visibility, refined.</span><span>NetMon PLATFORM <span aria-hidden="true">/</span> NETWORK OPERATIONS</span></footer>
    </div>
  );
};
