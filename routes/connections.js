const express = require('express');

let router = express.Router();

//Create connection to Heroku Database
let db = require('../utilities/utils').db;

let sendInvitationEmail = require('../utilities/utils_mail').sendInvitationEmail;


/** Fetch all of the contacts for the given user */
router.get("/", (req, res) => {
    res.type("application/json");

    let username = req.query['username'];
    let sentTo = req.query['sent_to'];
    let sentFrom = req.query['sent_from'];
    let isNotFriends = req.query['is_friends'];

    // Inform the user if they didn't enter username or location
    if (!username && !sentTo && !sentFrom) {
        return res.send({
            success: false,
            message: "Your request was not understand"
        });
    }


    if (username) {
        // Select the username from the Members table so that we can aquire the MemberID
        let query = "";
        if (isNotFriends) {
            console.log("isFriends = 1");
            query = `SELECT memberid, firstname, lastname, username, C1.id, C1.memberid_a, C1.memberid_b, C1.verified
                    FROM Members
                    JOIN (SELECT id, memberid_a, memberid_b, verified
                        FROM Contacts
                        WHERE memberid_a = $1 AND verified = 1) as C1
                        ON memberid_b = memberid
                    UNION
                    SELECT memberid, firstname, lastname, username, C2.id, C2.memberid_a, C2.memberid_b, C2.verified
                    FROM Members
                    JOIN (SELECT id, memberid_a, memberid_b, verified
                        FROM Contacts WHERE memberid_b = $1 AND verified = 1) as C2
                    ON memberid_a = memberid`;
        } else {
            console.log("isFriends = 0");
            query = `SELECT sub2.memberid, firstname, lastname, username
                    FROM Members
                    JOIN (SELECT sub.memberid FROM (
                            SELECT M1.memberid FROM Members M1
                            EXCEPT
                            SELECT C1.memberid_b FROM Contacts C1 WHERE C1.memberid_a = $1
                            INTERSECT
                            SELECT M2.memberid FROM Members M2
                            EXCEPT
                            SELECT C2.memberid_a FROM Contacts C2 WHERE C2.memberid_b = $1
                            ) AS sub
                            WHERE memberid != $1
                        ORDER BY memberid ASC) AS sub2
                    ON sub2.memberid = Members.memberid;`
        }

        db.one('SELECT MemberID FROM Members WHERE Username=$1', [username]).then(row => {
            let params = [row['memberid']];
            // Fetch all of the contacts with mutual connections to the given username 
            db.many(query, params).then(data => {
                res.send({
                    success: true,                
                    data: data,
                    message: 'Retreived ALL contacts'
                });
            })
            .catch(function (err) {
                console.log("ERROR Retreiving ALL Contacts!" + err);
                return res.send({
                    success: false,
                    message: "No connections found!"
                });
            });
        })
        .catch((err) => {
            res.send({
                success: false,
                message: "User does not exist!"
            });
        });
    } else if (sentTo) {
        // Select the username from the Members table so that we can aquire the MemberID
        db.one('SELECT MemberID FROM Members WHERE Username=$1', [sentTo]).then(row => {
            let params = [row['memberid']];
            console.log(params);
            db.many(`SELECT memberid, firstname, lastname, username, C2.id, C2.memberid_a, C2.memberid_b, C2.verified
                        FROM Members
                        JOIN (SELECT id, memberid_a, memberid_b, verified FROM Contacts WHERE memberid_b = $1 AND verified = 0) as C2
                        ON memberid_a = memberid` , params).then(data => {
                return res.send({
                        success: true,                
                        data: data,
                        message: 'Retreived ALL contacts SENT TO memberB!'
                });
            })
            .catch(function (err) {
                console.log("ERROR Retreiving ALL Contacts!" + err);
                return res.send({
                    success: false,
                    message: "No connection requests found!"
                });
            });
        })
        .catch((err) => {
            return res.send({
                    success: false,
                    message: "User does not exist!"
            });
        });
    } else if (sentFrom) {
        console.log(sentFrom);
        // Select the username from the Members table so that we can aquire the MemberID
        db.one('SELECT MemberID FROM Members WHERE Username=$1', [sentFrom]).then(row => {
            let params = [row['memberid']];
            console.log(params);
            db.many(`SELECT memberid, firstname, lastname, username, C2.id, C2.memberid_a, C2.memberid_b, C2.verified
            FROM Members
            JOIN (SELECT id, memberid_a, memberid_b, verified FROM Contacts WHERE memberid_a = $1 AND verified = 0) as C2
            ON memberid_b = memberid`, params).then(data => {
                res.send({
                    success: true,
                    data: data,
                    message: 'Retreived ALL contacts SENT FROM memberA!'
                });
            })
            .catch(function (err) {
                console.log("ERROR Retrieving ALL connection requests FROM: " + sentFrom + "\n" + err);
                return res.send({
                    success: false,
                    message: "No connection requests sent by you!"
                });
            });
        })
        .catch((err) => {
            return res.send({
                    success: false,
                    message: "User does not exist!"
            });
        });
    }
});


/** Create a connection request from userA to userB */
router.put("/", (req, res) => {
    res.type("application/json");
    
    let sentFromUsername = req.query['sent_from'];
    let sentToUsername = req.query['sent_to'];

    // Inform the user if they didn't enter username
    if (!sentFromUsername || !sentToUsername) {
        return res.send({
            success: false,
            message: "Two users are required to create a connection"
        });
    }

    db.one('SELECT MemberID FROM Members WHERE Username=$1', [sentFromUsername]).then(row => {
        let memberIdA = row['memberid'];
        db.one('SELECT MemberID FROM Members WHERE Username=$1', [sentToUsername]).then(row => {
            let memberIdB = row['memberid'];
            console.log("inserting: " + memberIdA, memberIdB);
            db.none("INSERT INTO Contacts (MemberID_A, MemberID_B) VALUES ($1, $2)", [memberIdA, memberIdB]).then(() => {
                return res.send({
                    success: true,
                    message: 'Connection request has been made!'
                });
            })
            .catch((err) => {
                console.log("ERROR: " + err);
                return res.send({
                    success: false,
                    message: "Could not add connection from memberA to memberB"
                });
            })
        })
        .catch((err) => {
            console.log("Couldn't find MemberIdB");
            return res.send({
                success: false,
                message: 'Username not found'
            });
        })
    })
    .catch((err) => {
        // If we couldn't find the username let the user know
        console.log("Couldn't find MemberIdA");
        return res.send({
            success: false,
            message: 'Username not found'
        });
    })


});// End router.put()


/** Remove a connection FROM userA to userB */
router.delete("/", (req, res) => {
    res.type("application/json");
    
    let sentFromUsername = req.query['sent_from'];
    let sentToUsername = req.query['sent_to'];

    // Inform the user if they didn't enter username
    if (!sentFromUsername && !sentToUsername) {
        return res.send({
            success: false,
            message: "Two users are required to create a connection"
        });
    }

    db.one('SELECT MemberID FROM Members WHERE Username=$1', [sentFromUsername]).then(row => {
        let memberIdA = row['memberid'];
        db.one('SELECT MemberID FROM Members WHERE Username=$1', [sentToUsername]).then(row => {
            let memberIdB = row['memberid'];
            console.log("removing: " + memberIdA, memberIdB);
            db.one("DELETE FROM Contacts WHERE ((MemberID_A=$1) AND (MemberID_B=$2)) OR ((MemberID_A=$2) AND (MemberID_B=$1))RETURNING *", [memberIdA, memberIdB]).then(nothing => {
                return res.send({
                    success: true,
                    message: 'Connection has been REMOVED!'
                });
            })
            .catch((err) => {
                console.log("ERROR: " + err);
                return res.send({
                    success: false,
                    message: "Could not DELETE connection between memberA and memberB"
                });
            });
        })
        .catch(err => {
            console.log("Couldn't find MemberIdB");
            return res.send({
                success: false,
                message: 'Username not found'
            });
        });
    })    
    .catch(err => {
        console.log("Couldn't find MemberIdB");
        return res.send({
            success: false,
            message: 'Username not found'
        });
    });  
});
    


/** Confirm a connection BETWEEN userA to userB */
router.get("/confirm", (req, res) => {
    res.type("application/json");
    
    let sentFromUsername = req.query['sent_from'];
    let sentToUsername = req.query['sent_to'];

    // Inform the user if they didn't enter username
    if (!sentFromUsername && !sentToUsername) {
        return res.send({
            success: false,
            message: "Two users are required to verify a connection"
        });
    }
    db.one('SELECT MemberID FROM Members WHERE Username=$1', [sentFromUsername]).then(row => {
        let memberIdA = row['memberid'];
        db.one('SELECT MemberID FROM Members WHERE Username=$1', [sentToUsername]).then(row => {
            let memberIdB = row['memberid'];
            console.log("Retreived ID's: " + memberIdA, memberIdB);
            db.one("UPDATE Contacts SET Verified=$1 WHERE ((MemberID_A=$2) AND (MemberID_B=$3)) RETURNING *", [1, memberIdA, memberIdB]).then(nothing => {
                return res.send({
                    success: true,
                    message: 'Connection has been CONFIRMED!'
                });
            })
            .catch((err) => {
                console.log("ERROR: " + err);
                return res.send({
                    success: false,
                    message: "Could not CONFIRM connection between memberA and memberB"
                });
            });
        })
        .catch(err => {
            console.log("Couldn't find MemberIdB");
            return res.send({
                success: false,
                message: 'Username not found'
            });
        });
    })    
    .catch(err => {
        console.log("Couldn't find MemberIdB");
        return res.send({
            success: false,
            message: 'Username not found'
        });
    });
});


/** Invite a connection FROM userA to offPlatformUser */
router.get("/invite", (req, res) => {
    res.type("application/json");

    let fromUsername = req.query['from_username'];
    let toFirstname = req.query['to_firstname'];
    let toEmail = req.query['to_email'];

    // Inform the user if they didn't enter username or location
    if (!fromUsername && !toFirstname && !toEmail) {
        return res.send({
            success: false,
            message: "Username, firstname, and email are ALL required!"
        });
    } else {
        // Select the username from the Members table so that we can aquire the MemberID
        db.one('SELECT Firstname FROM Members WHERE Username=$1', [fromUsername]).then(row => {
            let fromFirstName = [row['firstname']];
            sendInvitationEmail(toFirstname, toEmail, fromFirstName)
            .then(result => {
                // console.log("#####    BEGIN MAIL TRANSACTION    #####");
                console.log(result);
                // console.log("#####    END MAIL TRANSACTION    #####");
                return res.send({
                    success: true,
                    message: "Invitation email sent"
                });
            })
            .catch(err =>{
                console.log('Unable to send invitation email');
                console.log(err);
                return res.send({
                    success: false,
                    error: err['response'],
                    message: "Unable to send invitation email"
                });
            })
        })
        .catch((err) => {
            // If we fail here its likely because we violated the uniqueness constraint
            // Maybe we should upated instead?
            return res.send({
                    success: false,
                    message: "A valid username is required to send emails!"
                });
        
        });
    }
});



module.exports = router;