# jihou-bot-ts
Discord botをTypeScript×bun環境で作成しました。

## 機能紹介
・一日に一度特定のチャンネルへメッセージを送信  
・特定の文言をチャットするとオウム返しでメッセージを送信  
・一日に一度おみくじを引ける(5時更新)  

## コマンド
 /index         -現在スケジュールされているメッセージの一覧を確認できます。  
 /setschedule   -新しくメッセージをシュケジューリングします。  
 /edit          -既存のメッセージの時刻と内容を編集することができます。  
 /delete        -既存のメッセージをIDを指定して削除することができます。  
 /omikuji       -おみくじを引くことができるコマンドです。
 /deletemsg     -botの権限が高くなりがちなことを利用してメッセージを削除することができるコマンドです。使用するには開発者モードにする必要があります。  