const express = require("express");
const socketIO = require("socket.io");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const formatMessage = require("./utils/formatMSG");
const { saveUser, getDisconnectUser, getSameRoomUser} = require("./utils/user");

const Message = require("./models/Message");

const messageController = require("./controllers/message");

const app = express();
app.use(cors());

app.get("/room/:roomName",messageController.getOldMessages);
mongoose.connect(process.env.MONGO_URL).then(()=>{
    console.log("Connected to database.");
});

const server = app.listen(8000,()=>{
    console.log("Server is runnung at port 8000");
})

const io = socketIO(server,{
    cors : "*",
});

//run when client-server connected
io.on("connection",(socket)=>{
    console.log("Client connected");

    const BOT = "ROOM MANAGER BOT";
    
    //fired when user join room
    socket.on("joined_room",(data)=>{
        const { username, room } = data;
        const user = saveUser(socket.id, username, room);
        socket.join(user.room);

    //send welcome message to join room
    socket.emit("message",formatMessage(BOT,"Welcome to the room."));

    //send joined message to all users excepted of joined user
    socket.broadcast.to(user.room).emit("message",formatMessage(BOT,`${user.username} joined to the room.`));

    //listen message from client
    socket.on("message_send", (data)=>{
        //send back message to client
        io.to(user.room).emit("message",formatMessage(user.username,data));
        //store message in db
        Message.create({
            username : user.username,
            message : data,
            room : user.room,
        });
    });

    //send room users on join room
    io.to(user.room).emit("room_users",getSameRoomUser(user.room));
});

    //send disconnect message to all users
    socket.on("disconnect",()=>{
        const user = getDisconnectUser(socket.id);
        if(user){
            io.to(user.room).emit("message",formatMessage(BOT,`${user.username} leaved the room.`));
        }
        //update room users when disconnect
        io.to(user.room).emit("room_users",getSameRoomUser(user.room));
    })
})