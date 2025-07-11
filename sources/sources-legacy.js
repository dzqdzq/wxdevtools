import * as SourcesModule from "./sources.js";
self.Sources = self.Sources || {};
Sources = Sources || {};
Sources.AddSourceMapURLDialog =
  SourcesModule.AddSourceMapURLDialog.AddSourceMapURLDialog;
Sources.BreakpointEditDialog =
  SourcesModule.BreakpointEditDialog.BreakpointEditDialog;
Sources.BreakpointEditDialog.LogpointPrefix =
  SourcesModule.BreakpointEditDialog.LogpointPrefix;
Sources.BreakpointEditDialog._LogpointSuffix =
  SourcesModule.BreakpointEditDialog.LogpointSuffix;
Sources.BreakpointEditDialog.BreakpointType =
  SourcesModule.BreakpointEditDialog.BreakpointType;
Sources.CSSPlugin = SourcesModule.CSSPlugin.CSSPlugin;
Sources.CSSPlugin.maxSwatchProcessingLength =
  SourcesModule.CSSPlugin.maxSwatchProcessingLength;
Sources.CSSPlugin.SwatchBookmark = SourcesModule.CSSPlugin.SwatchBookmark;
Sources.CallStackSidebarPane =
  SourcesModule.CallStackSidebarPane.CallStackSidebarPane;
Sources.CallStackSidebarPane._debuggerCallFrameSymbol =
  SourcesModule.CallStackSidebarPane.debuggerCallFrameSymbol;
Sources.CallStackSidebarPane._elementSymbol =
  SourcesModule.CallStackSidebarPane.elementSymbol;
Sources.CallStackSidebarPane._defaultMaxAsyncStackChainDepth =
  SourcesModule.CallStackSidebarPane.defaultMaxAsyncStackChainDepth;
Sources.CallStackSidebarPane.ActionDelegate =
  SourcesModule.CallStackSidebarPane.ActionDelegate;
Sources.CallStackSidebarPane.Item = SourcesModule.CallStackSidebarPane.Item;
Sources.CoveragePlugin = SourcesModule.CoveragePlugin.CoveragePlugin;
Sources.DebuggerPausedMessage =
  SourcesModule.DebuggerPausedMessage.DebuggerPausedMessage;
Sources.DebuggerPausedMessage.BreakpointTypeNouns =
  SourcesModule.DebuggerPausedMessage.BreakpointTypeNouns;
Sources.DebuggerPlugin = SourcesModule.DebuggerPlugin.DebuggerPlugin;
Sources.DebuggerPlugin.BreakpointDecoration =
  SourcesModule.DebuggerPlugin.BreakpointDecoration;
Sources.DebuggerPlugin.continueToLocationDecorationSymbol =
  SourcesModule.DebuggerPlugin.continueToLocationDecorationSymbol;
Sources.EditingLocationHistoryManager =
  SourcesModule.EditingLocationHistoryManager.EditingLocationHistoryManager;
Sources.EditingLocationHistoryManager.HistoryDepth =
  SourcesModule.EditingLocationHistoryManager.HistoryDepth;
Sources.EditingLocationHistoryEntry =
  SourcesModule.EditingLocationHistoryManager.EditingLocationHistoryEntry;
Sources.FilePathScoreFunction =
  SourcesModule.FilePathScoreFunction.FilePathScoreFunction;
Sources.FilteredUISourceCodeListProvider =
  SourcesModule.FilteredUISourceCodeListProvider.FilteredUISourceCodeListProvider;
Sources.GoToLineQuickOpen = SourcesModule.GoToLineQuickOpen.GoToLineQuickOpen;
Sources.GutterDiffPlugin = SourcesModule.GutterDiffPlugin.GutterDiffPlugin;
Sources.GutterDiffPlugin.GutterDecoration =
  SourcesModule.GutterDiffPlugin.GutterDecoration;
Sources.GutterDiffPlugin.DiffGutterType =
  SourcesModule.GutterDiffPlugin.DiffGutterType;
Sources.GutterDiffPlugin.ContextMenuProvider =
  SourcesModule.GutterDiffPlugin.ContextMenuProvider;
Sources.InplaceFormatterEditorAction =
  SourcesModule.InplaceFormatterEditorAction.InplaceFormatterEditorAction;
Sources.JavaScriptBreakpointsSidebarPane =
  SourcesModule.JavaScriptBreakpointsSidebarPane.JavaScriptBreakpointsSidebarPane;
Sources.JavaScriptBreakpointsSidebarPane._locationSymbol =
  SourcesModule.JavaScriptBreakpointsSidebarPane.locationSymbol;
Sources.JavaScriptBreakpointsSidebarPane._checkboxLabelSymbol =
  SourcesModule.JavaScriptBreakpointsSidebarPane.checkboxLabelSymbol;
Sources.JavaScriptBreakpointsSidebarPane._snippetElementSymbol =
  SourcesModule.JavaScriptBreakpointsSidebarPane.snippetElementSymbol;
Sources.JavaScriptBreakpointsSidebarPane._breakpointLocationsSymbol =
  SourcesModule.JavaScriptBreakpointsSidebarPane.breakpointLocationsSymbol;
Sources.JavaScriptCompilerPlugin =
  SourcesModule.JavaScriptCompilerPlugin.JavaScriptCompilerPlugin;
Sources.JavaScriptCompilerPlugin.CompileDelay =
  SourcesModule.JavaScriptCompilerPlugin.CompileDelay;
Sources.NavigatorView = SourcesModule.NavigatorView.NavigatorView;
Sources.NavigatorView.Types = SourcesModule.NavigatorView.Types;
Sources.NavigatorFolderTreeElement =
  SourcesModule.NavigatorView.NavigatorFolderTreeElement;
Sources.NavigatorSourceTreeElement =
  SourcesModule.NavigatorView.NavigatorSourceTreeElement;
Sources.NavigatorTreeNode = SourcesModule.NavigatorView.NavigatorTreeNode;
Sources.NavigatorRootTreeNode =
  SourcesModule.NavigatorView.NavigatorRootTreeNode;
Sources.NavigatorUISourceCodeTreeNode =
  SourcesModule.NavigatorView.NavigatorUISourceCodeTreeNode;
Sources.NavigatorFolderTreeNode =
  SourcesModule.NavigatorView.NavigatorFolderTreeNode;
Sources.NavigatorGroupTreeNode =
  SourcesModule.NavigatorView.NavigatorGroupTreeNode;
Sources.OpenFileQuickOpen = SourcesModule.OpenFileQuickOpen.OpenFileQuickOpen;
Sources.OutlineQuickOpen = SourcesModule.OutlineQuickOpen.OutlineQuickOpen;
Sources.ScopeChainSidebarPane =
  SourcesModule.ScopeChainSidebarPane.ScopeChainSidebarPane;
Sources.ScopeChainSidebarPane._pathSymbol =
  SourcesModule.ScopeChainSidebarPane.pathSymbol;
Sources.ScriptFormatterEditorAction =
  SourcesModule.ScriptFormatterEditorAction.ScriptFormatterEditorAction;
Sources.ScriptOriginPlugin =
  SourcesModule.ScriptOriginPlugin.ScriptOriginPlugin;
Sources.ScriptOriginPlugin._linkifier =
  SourcesModule.ScriptOriginPlugin.linkifier;
Sources.SearchSourcesView = SourcesModule.SearchSourcesView.SearchSourcesView;
Sources.SearchSourcesView.ActionDelegate =
  SourcesModule.SearchSourcesView.ActionDelegate;
Sources.SimpleHistoryManager =
  SourcesModule.SimpleHistoryManager.SimpleHistoryManager;
Sources.HistoryEntry = SourcesModule.SimpleHistoryManager.HistoryEntry;
Sources.SnippetsPlugin = SourcesModule.SnippetsPlugin.SnippetsPlugin;
Sources.SourceMapNamesResolver = {};
Sources.SourceMapNamesResolver._scopeResolvedForTest = () => {};
Sources.SourceMapNamesResolver._cachedMapSymbol =
  SourcesModule.SourceMapNamesResolver.cachedMapSymbol;
Sources.SourceMapNamesResolver._cachedIdentifiersSymbol =
  SourcesModule.SourceMapNamesResolver.cachedIdentifiersSymbol;
Sources.SourceMapNamesResolver._scopeIdentifiers =
  SourcesModule.SourceMapNamesResolver.scopeIdentifiers;
Sources.SourceMapNamesResolver._resolveScope =
  SourcesModule.SourceMapNamesResolver.resolveScope;
Sources.SourceMapNamesResolver._allVariablesInCallFrame =
  SourcesModule.SourceMapNamesResolver.allVariablesInCallFrame;
Sources.SourceMapNamesResolver.resolveExpression =
  SourcesModule.SourceMapNamesResolver.resolveExpression;
Sources.SourceMapNamesResolver._resolveExpression =
  SourcesModule.SourceMapNamesResolver.resolveExpressionAsync;
Sources.SourceMapNamesResolver.resolveThisObject =
  SourcesModule.SourceMapNamesResolver.resolveThisObject;
Sources.SourceMapNamesResolver.resolveScopeInObject =
  SourcesModule.SourceMapNamesResolver.resolveScopeInObject;
Sources.SourceMapNamesResolver.Identifier =
  SourcesModule.SourceMapNamesResolver.Identifier;
Sources.SourceMapNamesResolver.RemoteObject =
  SourcesModule.SourceMapNamesResolver.RemoteObject;
Sources.NetworkNavigatorView =
  SourcesModule.SourcesNavigator.NetworkNavigatorView;
Sources.FilesNavigatorView = SourcesModule.SourcesNavigator.FilesNavigatorView;
Sources.OverridesNavigatorView =
  SourcesModule.SourcesNavigator.OverridesNavigatorView;
Sources.ContentScriptsNavigatorView =
  SourcesModule.SourcesNavigator.ContentScriptsNavigatorView;
Sources.SnippetsNavigatorView =
  SourcesModule.SourcesNavigator.SnippetsNavigatorView;
Sources.ActionDelegate = SourcesModule.SourcesNavigator.ActionDelegate;
Sources.SourcesPanel = SourcesModule.SourcesPanel.SourcesPanel;
Sources.SourcesPanel._lastModificationTimeout =
  SourcesModule.SourcesPanel.lastModificationTimeout;
Sources.SourcesPanel.minToolbarWidth =
  SourcesModule.SourcesPanel.minToolbarWidth;
Sources.SourcesPanel.UILocationRevealer =
  SourcesModule.SourcesPanel.UILocationRevealer;
Sources.SourcesPanel.DebuggerLocationRevealer =
  SourcesModule.SourcesPanel.DebuggerLocationRevealer;
Sources.SourcesPanel.UISourceCodeRevealer =
  SourcesModule.SourcesPanel.UISourceCodeRevealer;
Sources.SourcesPanel.DebuggerPausedDetailsRevealer =
  SourcesModule.SourcesPanel.DebuggerPausedDetailsRevealer;
Sources.SourcesPanel.RevealingActionDelegate =
  SourcesModule.SourcesPanel.RevealingActionDelegate;
Sources.SourcesPanel.DebuggingActionDelegate =
  SourcesModule.SourcesPanel.DebuggingActionDelegate;
Sources.SourcesPanel.WrapperView = SourcesModule.SourcesPanel.WrapperView;
Sources.SourcesSearchScope =
  SourcesModule.SourcesSearchScope.SourcesSearchScope;
Sources.FileBasedSearchResult =
  SourcesModule.SourcesSearchScope.FileBasedSearchResult;
Sources.SourcesView = SourcesModule.SourcesView.SourcesView;
Sources.SourcesView.Events = SourcesModule.SourcesView.Events;
Sources.SourcesView.EditorAction = SourcesModule.SourcesView.EditorAction;
Sources.SourcesView.SwitchFileActionDelegate =
  SourcesModule.SourcesView.SwitchFileActionDelegate;
Sources.SourcesView.ActionDelegate = SourcesModule.SourcesView.ActionDelegate;
Sources.TabbedEditorContainer =
  SourcesModule.TabbedEditorContainer.TabbedEditorContainer;
Sources.TabbedEditorContainer.Events =
  SourcesModule.TabbedEditorContainer.Events;
Sources.TabbedEditorContainer._tabId =
  SourcesModule.TabbedEditorContainer.tabId;
Sources.TabbedEditorContainer.maximalPreviouslyViewedFilesCount =
  SourcesModule.TabbedEditorContainer.maximalPreviouslyViewedFilesCount;
Sources.TabbedEditorContainer.HistoryItem =
  SourcesModule.TabbedEditorContainer.HistoryItem;
Sources.TabbedEditorContainer.History =
  SourcesModule.TabbedEditorContainer.History;
Sources.TabbedEditorContainerDelegate =
  SourcesModule.TabbedEditorContainer.TabbedEditorContainerDelegate;
Sources.EditorContainerTabDelegate =
  SourcesModule.TabbedEditorContainer.EditorContainerTabDelegate;
Sources.ThreadsSidebarPane =
  SourcesModule.ThreadsSidebarPane.ThreadsSidebarPane;
Sources.UISourceCodeFrame = SourcesModule.UISourceCodeFrame.UISourceCodeFrame;
Sources.UISourceCodeFrame._iconClassPerLevel =
  SourcesModule.UISourceCodeFrame.iconClassPerLevel;
Sources.UISourceCodeFrame._bubbleTypePerLevel =
  SourcesModule.UISourceCodeFrame.bubbleTypePerLevel;
Sources.UISourceCodeFrame._lineClassPerLevel =
  SourcesModule.UISourceCodeFrame.lineClassPerLevel;
Sources.UISourceCodeFrame.RowMessage =
  SourcesModule.UISourceCodeFrame.RowMessage;
Sources.UISourceCodeFrame.RowMessageBucket =
  SourcesModule.UISourceCodeFrame.RowMessageBucket;
Sources.UISourceCodeFrame.Plugin = SourcesModule.Plugin.Plugin;
Sources.UISourceCodeFrame.Events = SourcesModule.UISourceCodeFrame.Events;
Sources.WatchExpressionsSidebarPane =
  SourcesModule.WatchExpressionsSidebarPane.WatchExpressionsSidebarPane;
Sources.WatchExpression =
  SourcesModule.WatchExpressionsSidebarPane.WatchExpression;
