'use client';

import React, { useEffect, useState } from 'react';

// import {
//   DeviceActivity,
//   PersonalInfo,
//   savePersonalInfo,
//   useEnvironment,
// } from '@keycloak/keycloak-account-ui';

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  User,
  Monitor,
  Key,
  Smartphone,
  LogOut,
  CheckCircle,
  AlertCircle,
  Save,
  RefreshCw,
} from 'lucide-react';

/* ---------- Types ---------- */
type ActiveTab = 'general' | 'signing-in' | 'device-activity';

type SaveStatusType = '' | 'saving' | 'success';
type SaveStatus = { type: SaveStatusType; message: string };

type FormField =
  | 'username'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'institution'
  | 'university';

type FormData = Record<FormField, string>;

type Device = {
  id: string;
  platform: string;
  browser: string;
  current: boolean;
  ip: string;
  lastAccessed: string;
  clients: string[];
  started: string;
  expires: string;
};

/* ---------- Component ---------- */
export default function MyAccount() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('general');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    type: '',
    message: '',
  });
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    institution: '',
    university: '',
  });

  const devices: Device[] = [
    {
      id: '1',
      platform: 'Ubuntu',
      browser: 'Firefox/141.0',
      current: true,
      ip: '172.17.0.1',
      lastAccessed: 'August 20, 2025 at 9:44 PM',
      clients: ['Account Console'],
      started: 'August 20, 2025 at 9:42 PM',
      expires: 'August 21, 2025 at 7:42 AM',
    },
    {
      id: '2',
      platform: 'Windows 10',
      browser: 'Chrome/115.0',
      current: false,
      ip: '192.168.1.15',
      lastAccessed: 'August 19, 2025 at 2:30 PM',
      clients: ['Account Console', 'Mobile App'],
      started: 'August 18, 2025 at 10:15 AM',
      expires: 'August 25, 2025 at 10:15 AM',
    },
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      setFormData({
        username: 'johndoe',
        email: 'john.doe@example.com',
        firstName: 'John',
        lastName: 'Doe',
        institution: 'Tech University',
        university: 'State University',
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    const key = id as FormField; // assert to our union
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaveStatus({ type: 'saving', message: 'Saving changes...' });
    setTimeout(() => {
      setSaveStatus({
        type: 'success',
        message: 'Your changes have been saved successfully.',
      });
      setTimeout(() => setSaveStatus({ type: '', message: '' }), 3000);
    }, 1500);
  };

  const handleSignOutDevice = (deviceId: string) => {
    console.log('Sign out device:', deviceId);
  };

  const formatLabel = (field: FormField): string => {
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace('University', 'University (Optional)');
  };

  if (isLoading) {
    return (
      <div className="font-sans min-h-screen p-6 sm:p-12 pb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          <aside className="md:col-span-1">
            <Skeleton className="h-6 w-32 mb-4" />
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-4 w-full mb-2" />
            ))}
          </aside>
          <section className="md:col-span-3 space-y-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="rounded-xl">
                <CardHeader>
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-60" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-10 w-32" />
                </CardContent>
              </Card>
            ))}
          </section>
        </div>
      </div>
    );
  }

  const fields: Readonly<FormField[]> = [
    'firstName',
    'lastName',
    'username',
    'email',
    'institution',
    'university',
  ];

  return (
    <div className="font-sans min-h-screen p-6 sm:p-12 pb-20">
      <main className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        <aside className="md:col-span-1">
          <nav className="sticky top-24 space-y-1">
            <h2 className="text-lg font-semibold mb-4">Account Settings</h2>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => setActiveTab('general')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center ${activeTab === 'general' ? 'font-medium' : ''}`}
                >
                  <User className="h-4 w-4 mr-2" />
                  Personal Info
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('signing-in')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center ${activeTab === 'signing-in' ? 'font-medium' : ''}`}
                >
                  <Key className="h-4 w-4 mr-2" />
                  Signing In
                </button>
              </li>
              <li>
                <button
                  onClick={() => setActiveTab('device-activity')}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center ${activeTab === 'device-activity' ? 'font-medium' : ''}`}
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  Device Activity
                </button>
              </li>
            </ul>
          </nav>
        </aside>

        <section className="md:col-span-3 space-y-6">
          {saveStatus.message && (
            <Alert
              variant={saveStatus.type === 'success' ? 'default' : 'destructive'}
              className="mb-4"
            >
              {saveStatus.type === 'success' ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{saveStatus.message}</AlertDescription>
            </Alert>
          )}

          {activeTab === 'general' && (
            <Card id="general" className="rounded-xl shadow-sm border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Manage your basic personal information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSave} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {fields.map((field) => (
                      <div key={field} className="space-y-2">
                        <Label htmlFor={field}>{formatLabel(field)}</Label>
                        <Input
                          id={field}
                          value={formData[field]}
                          onChange={handleInputChange}
                          placeholder={`Enter ${field
                            .replace(/([A-Z])/g, ' $1')
                            .toLowerCase()}`}
                          type={field === 'email' ? 'email' : 'text'}
                          className="rounded-lg"
                          required={field !== 'university'}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      className="rounded-lg px-5 gap-2"
                      disabled={saveStatus.type === 'saving'}
                    >
                      {saveStatus.type === 'saving' ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" /> Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {activeTab === 'signing-in' && (
            <Card id="signing-in" className="rounded-xl shadow-sm border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold flex items-center">
                  <Key className="h-5 w-5 mr-2" />
                  Signing In
                </CardTitle>
                <CardDescription>
                  Configure your sign-in methods and security preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h3 className="font-medium flex items-center">
                    <Key className="h-4 w-4 mr-2" /> Password
                  </h3>
                  <p className="text-sm">Sign in by entering your password.</p>
                  <div className="flex items-center justify-between border rounded-xl p-4">
                    <div>
                      <p className="text-sm font-medium">My password</p>
                      <p className="text-xs">Created August 20, 2025 at 6:45 PM</p>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-lg gap-2">
                      <Key className="h-4 w-4" /> Change
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="font-medium flex items-center">
                    <Shield className="h-4 w-4 mr-2" /> Two-Factor Authentication
                  </h3>
                  <p className="text-sm">
                    Add an extra layer of security to your account.
                  </p>
                  <div className="flex items-center justify-between border rounded-xl p-4">
                    <div>
                      <p className="text-sm font-medium">Authenticator application</p>
                      <p className="text-xs">
                        Enter a verification code from authenticator application.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-lg gap-2">
                      <Smartphone className="h-4 w-4" /> Set up
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === 'device-activity' && (
            <Card id="device-activity" className="rounded-xl shadow-sm border-0">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold flex items-center">
                  <Monitor className="h-5 w-5 mr-2" /> Device Activity
                </CardTitle>
                <CardDescription>
                  Review and manage your active sessions. Sign out of any unfamiliar
                  devices.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border">
                  <p className="text-sm flex items-start">
                    <AlertCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                    You are currently signed in to {devices.length} device
                    {devices.length !== 1 ? 's' : ''}.
                  </p>
                </div>

                {devices.map((device) => (
                  <div key={device.id} className="border rounded-xl overflow-hidden">
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <h3 className="font-medium text-sm flex items-center">
                          {device.platform} / {device.browser}
                          {device.current && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Current Session
                            </Badge>
                          )}
                        </h3>
                        {!device.current && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg gap-2"
                            onClick={() => handleSignOutDevice(device.id)}
                          >
                            <LogOut className="h-4 w-4" /> Sign Out
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs font-medium">IP address</p>
                          <p className="text-sm">{device.ip}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium">Last accessed</p>
                          <p className="text-sm">{device.lastAccessed}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium">Clients</p>
                          <p className="text-sm">{device.clients.join(', ')}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium">Started</p>
                          <p className="text-sm">{device.started}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium">Expires</p>
                          <p className="text-sm">{device.expires}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </div>
  );
}
