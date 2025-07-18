import * as SourceFrameModule from "./source_frame.js";
self.SourceFrame = self.SourceFrame || {};
SourceFrame = SourceFrame || {};
SourceFrame.BinaryResourceViewFactory =
  SourceFrameModule.BinaryResourceViewFactory.BinaryResourceViewFactory;
SourceFrame.FontView = SourceFrameModule.FontView.FontView;
SourceFrame.ImageView = SourceFrameModule.ImageView.ImageView;
SourceFrame.JSONView = SourceFrameModule.JSONView.JSONView;
SourceFrame.ParsedJSON = SourceFrameModule.JSONView.ParsedJSON;
SourceFrame.PreviewFactory = SourceFrameModule.PreviewFactory.PreviewFactory;
SourceFrame.ResourceSourceFrame =
  SourceFrameModule.ResourceSourceFrame.ResourceSourceFrame;
SourceFrame.ResourceSourceFrame.SearchableContainer =
  SourceFrameModule.ResourceSourceFrame.SearchableContainer;
SourceFrame.SourceCodeDiff = SourceFrameModule.SourceCodeDiff.SourceCodeDiff;
SourceFrame.SourceCodeDiff.EditType = SourceFrameModule.SourceCodeDiff.EditType;
SourceFrame.SourceFrame = SourceFrameModule.SourceFrame.SourceFrameImpl;
SourceFrame.LineDecorator = SourceFrameModule.SourceFrame.LineDecorator;
SourceFrame.SourcesTextEditor =
  SourceFrameModule.SourcesTextEditor.SourcesTextEditor;
SourceFrame.SourcesTextEditor.Events =
  SourceFrameModule.SourcesTextEditor.Events;
SourceFrame.SourcesTextEditor.lineNumbersGutterType =
  SourceFrameModule.SourcesTextEditor.lineNumbersGutterType;
SourceFrame.SourcesTextEditorDelegate =
  SourceFrameModule.SourcesTextEditor.SourcesTextEditorDelegate;
SourceFrame.SourcesTextEditor.TokenHighlighter =
  SourceFrameModule.SourcesTextEditor.TokenHighlighter;
SourceFrame.XMLView = SourceFrameModule.XMLView.XMLView;
SourceFrame.XMLView.Node = SourceFrameModule.XMLView.XMLViewNode;
