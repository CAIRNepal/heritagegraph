import React from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './config/queryClient';
import '@civicactions/data-catalog-components/dist/index.css';
import './theme/index.css';

import Home from './templates/home';
import About from './templates/about';
import SearchTemplate from './templates/search';
import ApiDocsFull from './templates/api';
import NotFound from './templates/not_found';
import Dataset from './templates/dataset';
import ApiDocsSpecific from './templates/dataset/api';
import Publishers from './templates/publishers';
import Form from './templates/form';
import Curation from './templates/curation';
import Activity from './templates/activity';
import Queues from './templates/queues';
import WebformSubmissions from './templates/test';
import Leaderboard from './templates/leaderboard';
import { ClerkProvider } from '@clerk/clerk-react';
import SignUp from './templates/signupPanel';
import Moderator from './templates/moderator';
import Profile from './templates/profile';
import Viewresponse from './templates/viewResponse';
import ViewProfileOrForm from './templates/viewprofile';
import Contributors from './templates/contributor';
import LoginPortal from './templates/signin';
import Layout from './components/Layout/';

const clerk_key = import.meta.env.VITE_CLERK_KEY;
if (!clerk_key) {
  throw new Error('Clerk Publishable Key Not Found in Environment Variables');
}

const router = createBrowserRouter([
  {
    element: (
      <Layout title="Home" description="Explore Nepal's cultural heritage with Heritage Graph">
        <Home />
      </Layout>
    ),
    path: '/',
  },
  {
    path: '/home',
    element: <Navigate replace to="/" />,
  },
  {
    element: (
      <Layout title="About" description="Learn about Heritage Graph and its mission">
        <About />
      </Layout>
    ),
    path: '/about',
  },
  {
    element: (
      <Layout title="Publishers" description="Explore publishers on Heritage Graph">
        <Publishers />
      </Layout>
    ),
    path: '/publishers',
  },
  {
    element: (
      <Layout title="Search" description="Search datasets on Heritage Graph">
        <SearchTemplate />
      </Layout>
    ),
    path: '/search',
  },
  {
    element: (
      <Layout title="API Docs" description="API documentation for Heritage Graph">
        <ApiDocsFull />
      </Layout>
    ),
    path: '/api',
  },
  {
    element: (
      <Layout title="Dataset" description="View dataset details on Heritage Graph">
        <Dataset />
      </Layout>
    ),
    path: '/dataset/:id',
  },
  {
    element: (
      <Layout title="Dataset API" description="API details for a dataset on Heritage Graph">
        <ApiDocsSpecific />
      </Layout>
    ),
    path: '/dataset/:id/api',
  },
  {
    element: (
      <Layout title="Contribute" description="Contribute to Heritage Graph">
        <Form />
      </Layout>
    ),
    path: '/contribution',
  },
  {
    element: (
      <Layout title="Curation" description="Curation tools for Heritage Graph">
        <Curation />
      </Layout>
    ),
    path: '/curation',
  },
  {
    element: (
      <Layout title="Activity" description="View activity on Heritage Graph">
        <Activity />
      </Layout>
    ),
    path: '/curation/activity',
  },
  {
    element: (
      <Layout title="Queues" description="Manage queues on Heritage Graph">
        <Queues />
      </Layout>
    ),
    path: '/curation/queues',
  },
  {
    element: (
      <Layout title="Leaderboard" description="View the leaderboard on Heritage Graph">
        <Leaderboard />
      </Layout>
    ),
    path: '/leaderboard',
  },
  {
    element: (
      <Layout title="Test" description="Test page on Heritage Graph">
        <WebformSubmissions />
      </Layout>
    ),
    path: '/test',
  },
  {
    path: '/login',
    element: <LoginPortal />,
  },
  {
    path: '/signup',
    element: <SignUp />,
  },
  {
    element: (
      <Layout title="Moderator" description="Moderator tools for Heritage Graph">
        <Moderator />
      </Layout>
    ),
    path: '/moderator',
  },
  {
    element: (
      <Layout title="View Response" description="View response details on Heritage Graph">
        <Viewresponse />
      </Layout>
    ),
    path: '/viewresponse/:id',
  },
  {
    element: (
      <Layout title="Profile" description="View your profile on Heritage Graph">
        <Profile />
      </Layout>
    ),
    path: '/me',
  },
  {
    element: (
      <Layout title="Not Found" description="Page not found on Heritage Graph">
        <NotFound />
      </Layout>
    ),
    path: '*',
  },
  {
    element: (
      <Layout title="View Profile" description="View user profile on Heritage Graph">
        <ViewProfileOrForm />
      </Layout>
    ),
    path: '/view/:username',
  },
  {
    element: (
      <Layout title="View Form" description="View form on Heritage Graph">
        <ViewProfileOrForm />
      </Layout>
    ),
    path: '/viewform/:title',
  },
  {
    element: (
      <Layout title="Contributors" description="View contributors on Heritage Graph">
        <Contributors />
      </Layout>
    ),
    path: '/contributors',
  },
]);

createRoot(document.getElementById('root')).render(
  <ClerkProvider publishableKey={clerk_key} afterSignOutUrl="/">
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </ClerkProvider>
);