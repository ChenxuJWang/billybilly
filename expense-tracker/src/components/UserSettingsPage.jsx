import React, { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import ProfileSettings from '@/components/ProfileSettings.jsx';
import SmartCategorizationSettings from '@/components/SmartCategorizationSettings.jsx';

function RouteFallback() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded bg-gray-200"></div>
      <div className="h-40 rounded bg-gray-200"></div>
    </div>
  );
}

export default function UserSettingsPage({
  smartCategorizationEnabled,
  setSmartCategorizationEnabled,
  debugModeEnabled,
  setDebugModeEnabled,
  thinkingModeEnabled,
  setThinkingModeEnabled,
}) {
  return (
    <div className="p-6 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-gray-900">Your Settings</h1>
        <p className="text-sm text-gray-600">
          Update your profile and the personal tools you use while working across ledgers.
        </p>
      </div>

      <Suspense fallback={<RouteFallback />}>
        <ProfileSettings />
      </Suspense>

      <Suspense fallback={<RouteFallback />}>
        <SmartCategorizationSettings
          smartCategorizationEnabled={smartCategorizationEnabled}
          setSmartCategorizationEnabled={setSmartCategorizationEnabled}
          debugModeEnabled={debugModeEnabled}
          setDebugModeEnabled={setDebugModeEnabled}
          thinkingModeEnabled={thinkingModeEnabled}
          setThinkingModeEnabled={setThinkingModeEnabled}
        />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>Workspace Preferences</CardTitle>
          <CardDescription>
            Additional personal preferences can grow here without mixing them into ledger admin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">More user-level settings can be added in a future milestone.</p>
        </CardContent>
      </Card>
    </div>
  );
}
