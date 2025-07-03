import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from "../contexts/AuthContext";
import { useLedger } from "../contexts/LedgerContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle } from "lucide-react";

function SmartCategorizationSettings({
  smartCategorizationEnabled,
  setSmartCategorizationEnabled,
  debugModeEnabled, // New prop for debug mode
  setDebugModeEnabled // New prop for debug mode
}) {
  const { currentUser } = useAuth();
  const { currentLedger } = useLedger();
  const [apiKey, setApiKey] = useState("");
  const [apiKeyConfirmed, setApiKeyConfirmed] = useState(false);
  const [apiKeyError, setApiKeyError] = useState("");
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(`You are a financial-data assistant. I will provide you with a CSV file of transactions containing at least the following columns: Date, Description, Amount.  Response in JSON and say nothing else:\n\n1. For each row, determine whether it is an **expense** or an **income**.   \n\n2. Assign each transaction to one of the following **Expense** or **Income** categories (or to a special category if needed):\n\n   **Expense Categories**  \n   ${currentLedger?.expenseCategories?.map(cat => `- ${cat.name}`).join("\\n") || "- HTT: (Hard To Tell) if you can\\\"t unambiguously assign one of the above"}\n
   **Income Categories**  \n   ${currentLedger?.incomeCategories?.map(cat => `- ${cat.name}`).join("\\n") || "- HTT"}\n
   Use merchant names, keywords in the description, or amount signs to guide your choice.  \n
3. Output a single JSON object with this exact structure:\n
\
{\n  "transactions": [\n    {\n      "id": "<self-increment id>",\n      "category": "<one of the given categories: Bills & Utilities, \u2026, Refund, HTT>"\n    }\n  ]\n}\n
4.  Optionally, "corrections" showing prior mis-classifications I\\\"ve corrected may be provided to guide this categorization `);
  const [systemPromptConfirmed, setSystemPromptConfirmed] = useState(false);
  const [systemPromptError, setSystemPromptError] = useState("");
  const [systemPromptLoading, setSystemPromptLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);

  // Load settings from Firestore on component mount
  useEffect(() => {
    const loadSettings = async () => {
      if (!currentUser) return;

      setSettingsLoading(true);
      try {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setSmartCategorizationEnabled(userData.smartCategorizationEnabled || false);
          setApiKey(userData.llmApiKey || "");
          if (userData.llmApiKey) {
            setApiKeyConfirmed(true);
          }
        }
      } catch (error) {
        console.error("Error loading smart categorization settings:", error);
      } finally {
        setSettingsLoading(false);
      }
    };

    loadSettings();
  }, [currentUser, setSmartCategorizationEnabled]);

  // Save smartCategorizationEnabled to Firestore
  useEffect(() => {
    if (currentUser && !settingsLoading) {
      const saveSetting = async () => {
        try {
          const userDocRef = doc(db, "users", currentUser.uid);
          await updateDoc(userDocRef, {
            smartCategorizationEnabled: smartCategorizationEnabled,
            updatedAt: new Date(),
          });
        } catch (error) {
          console.error("Error saving smart categorization setting:", error);
        }
      };
      saveSetting();
    }
  }, [smartCategorizationEnabled, currentUser, settingsLoading]);

  const handleApiKeyConfirm = async () => {
    if (!apiKey.trim()) {
      setApiKeyError("Please enter an API key.");
      return;
    }

    setApiKeyLoading(true);
    setApiKeyError("");

    try {
      const response = await fetch("https://ark.cn-beijing.volces.com/api/v3/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              content: "hello world",
              role: "user",
            },
          ],
          model: "doubao-seed-1-6-flash-250615",
        }),
      });

      if (response.ok) {
        setApiKeyConfirmed(true);
        setApiKeyError("");
        if (currentUser) {
          const userDocRef = doc(db, "users", currentUser.uid);
          await updateDoc(userDocRef, {
            llmApiKey: apiKey,
            updatedAt: new Date(),
          });
        }
      } else {
        const errorData = await response.json();
        setApiKeyError(`API Key verification failed: ${errorData.message || response.statusText}`);
        setApiKeyConfirmed(false);
      }
    } catch (error) {
      setApiKeyError(`Network error: ${error.message}`);
      setApiKeyConfirmed(false);
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleSystemPromptConfirm = () => {
    if (systemPrompt.trim()) {
      setSystemPromptConfirmed(true);
      setSystemPromptError("");
    } else {
      setSystemPromptError("System prompt cannot be empty.");
    }
  };

  if (settingsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Smart Categorization Settings</CardTitle>
          <CardDescription>Loading settings...</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Smart Categorization Settings</CardTitle>
        <CardDescription>Configure settings for LLM-powered transaction categorization.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between space-x-2 mb-4">
          <Label htmlFor="smart-categorization-mode">Enable Smart Categorization</Label>
          <Switch
            id="smart-categorization-mode"
            checked={smartCategorizationEnabled}
            onCheckedChange={setSmartCategorizationEnabled}
          />
        </div>

        {smartCategorizationEnabled && (
          <div className="space-y-4">
            <div className="flex items-center justify-between space-x-2 mb-4">
              <Label htmlFor="debug-mode">Enable Debug Mode (Session Only)</Label>
              <Switch
                id="debug-mode"
                checked={debugModeEnabled}
                onCheckedChange={setDebugModeEnabled}
              />
            </div>

            <div className="space-y-4 mb-4">
              <Label htmlFor="api-key">Doubao API Key</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="api-key"
                  type="password"
                  placeholder="Enter your Doubao API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={apiKeyConfirmed || apiKeyLoading}
                />
                <Button onClick={handleApiKeyConfirm} disabled={apiKeyLoading || apiKeyConfirmed}>
                  {apiKeyLoading ? "Verifying..." : apiKeyConfirmed ? <CheckCircle className="h-4 w-4" /> : "Verify"}
                </Button>
              </div>
              {apiKeyError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{apiKeyError}</AlertDescription>
                </Alert>
              )}
              {apiKeyConfirmed && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>API Key verified successfully!</AlertDescription>
                </Alert>
              )}
            </div>

            {debugModeEnabled && (
              <div className="space-y-4">
                <Label htmlFor="system-prompt">System Prompt</Label>
                <Textarea
                  id="system-prompt"
                  placeholder="Enter the system prompt for LLM categorization"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={10}
                  disabled={systemPromptConfirmed}
                />
                <Button onClick={handleSystemPromptConfirm} disabled={systemPromptConfirmed}>
                  {systemPromptConfirmed ? <CheckCircle className="h-4 w-4" /> : "Confirm Prompt"}
                </Button>
                {systemPromptError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{systemPromptError}</AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SmartCategorizationSettings;


