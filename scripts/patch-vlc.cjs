// Small, repeatable fixes against the pinned 1.0.98 native bridge.
// Keep this in postinstall so CI and a clean Windows checkout get identical sources.
const fs = require("node:fs");
const path = require("node:path");
const file = path.resolve(
  __dirname,
  "../node_modules/react-native-vlc-media-player/ios/RCTVLCPlayer/RCTVLCPlayer.m",
);
let source = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const marker = "// Still native bridge fixes v1";
if (source.includes(marker)) process.exit(0);
function replace(before, after) {
  if (!source.includes(before))
    throw new Error(
      "Pinned VLC bridge changed; review patch: " + before.slice(0, 60),
    );
  source = source.replace(before, after);
}
replace(
  'int initType = [source objectForKey:@"initType"];',
  'int initType = [[source objectForKey:@"initType"] intValue];',
);
replace(
  'NSDictionary* initOptions = [source objectForKey:@"initOptions"];',
  'NSArray* initOptions = [source objectForKey:@"initOptions"];',
);
replace("NSString * _subtitleUri;", "NSURL * _subtitleUri;");
replace(
  "VLCConsoleLogger *consoleLogger = [[VLCConsoleLogger alloc] init];\n    consoleLogger.level = kVLCLogLevelDebug;\n    library.loggers = @[consoleLogger];",
  "library.loggers = @[]; // Do not log authenticated media URLs.",
);
replace(
  "#if !defined(DEBUG) || !(TARGET_IPHONE_SIMULATOR)",
  "#if 1 // Media URLs and user defaults must never be logged.",
);
replace(
  "- (void)applicationWillResignActive:(NSNotification *)notification\n{\n    if (!_paused)\n        [self play];\n}",
  "- (void)applicationWillResignActive:(NSNotification *)notification\n{\n    if (!_paused)\n        [self pause];\n}",
);
replace(
  "if (_player) {\n        [_player play];",
  "if (_player) {\n        [[AVAudioSession sharedInstance] setCategory:AVAudioSessionCategoryPlayback error:nil];\n        [[AVAudioSession sharedInstance] setActive:YES error:nil];\n        [_player play];",
);
replace(
  "if (_autoplay)\n        [_player play];\n    \n    [[AVAudioSession sharedInstance] setActive:NO withOptions:AVAudioSessionSetActiveOptionNotifyOthersOnDeactivation error:nil];",
  "if (_autoplay)\n        [self play];",
);
replace(
  "// This callback doesn't have any data about the error, we need to rely on the error dialog\n                [self _release];",
  'if (self.onVideoError) {\n                    self.onVideoError(@{@"target": self.reactTag});\n                }\n                [self _release];',
);
replace(
  "if (_player.media)\n        [_player stop];",
  "_player.delegate = nil;\n    _player.drawable = nil;\n    self.dialogProvider = nil;\n    if (_player.media)\n        [_player stop];",
);
fs.writeFileSync(file, marker + "\n" + source);
console.log("Applied Still iOS VLC bridge fixes.");
