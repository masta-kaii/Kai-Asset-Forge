import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Settings, Key, Globe, Palette, BellRing } from "lucide-react"
import { FIREBASE_REQUIRED_KEYS } from "@/lib/firebase/config"

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure your forge, API keys, and agent behavior
        </p>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Key className="size-5" />
            Firebase Configuration
          </CardTitle>
          <CardDescription>
            Connect your Firebase project backend
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {FIREBASE_REQUIRED_KEYS.map((key) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{key}</Label>
              <Input
                id={key}
                type="password"
                placeholder={`Enter ${key}`}
                className="font-mono text-sm"
              />
            </div>
          ))}
          <Button className="gap-2">
            <Key className="size-4" />
            Save & Connect
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="size-5" />
            API Keys
          </CardTitle>
          <CardDescription>
            Configure AI service API keys
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai-key">OpenAI API Key</Label>
            <Input
              id="openai-key"
              type="password"
              placeholder="sk-..."
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="claude-key">Anthropic API Key</Label>
            <Input
              id="claude-key"
              type="password"
              placeholder="sk-ant-..."
              className="font-mono text-sm"
            />
          </div>
          <Button variant="outline" className="gap-2">
            <Key className="size-4" />
            Save API Keys
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="size-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize the forge interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-muted-foreground">
                Toggle between light and dark themes
              </p>
            </div>
            <Button variant="outline" size="sm">
              Coming Soon
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BellRing className="size-5" />
            Automation
          </CardTitle>
          <CardDescription>
            Configure automated workflows and scheduling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Daily Asset Generation</p>
              <p className="text-xs text-muted-foreground">
                Auto-generate assets on a schedule
              </p>
            </div>
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium">Social Media Automation</p>
              <p className="text-xs text-muted-foreground">
                Auto-generate marketing content
              </p>
            </div>
            <Button variant="outline" size="sm">
              Configure
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
