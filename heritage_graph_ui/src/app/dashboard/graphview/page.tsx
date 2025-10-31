'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Page() {
  const handleClick = () => {
    alert('Hello World!');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="shadow-lg rounded-xl p-6">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Hello World!</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            Welcome to your new Next.js page.
          </p>
          <Button onClick={handleClick}>Click Me</Button>
        </CardContent>
      </Card>
    </div>
  );
}
