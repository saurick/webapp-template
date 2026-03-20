{{- define "webapp-template.selectorLabels" -}}
app.kubernetes.io/name: {{ required "app.name is required" .Values.app.name }}
{{- with .Values.app.instance }}
app.kubernetes.io/instance: {{ . }}
{{- end }}
{{- end }}
