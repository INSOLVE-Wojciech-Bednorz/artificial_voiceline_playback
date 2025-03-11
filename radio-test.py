import vlc

# Path to the .pls file
pls_file = "RMF-FM.pls"

# Create VLC instance
player = vlc.MediaPlayer()

# Load the .pls file into the player
media = vlc.Media(pls_file)

# Set media to player and play it
player.set_media(media)
player.play()

# Keep the script running to listen to the stream
input("Press Enter to stop streaming...")
player.stop()
